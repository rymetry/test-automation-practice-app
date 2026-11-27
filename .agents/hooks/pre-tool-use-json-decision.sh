#!/usr/bin/env bash
# 終了コードではなく標準出力の JSON で可否を受け取るエージェント向けに、共通の判定結果を変換する。
set -uo pipefail

# jq を入れるコマンドも止めないよう、標準入力は外部コマンドを使わずに読む。
IFS= read -r -d '' input || true

# jq がない環境でも外部コマンドを使わずに指定キーの JSON 文字列値だけを取り出す。
extract_json_string() {
  local json="$1" key="$2" search rest value="" chunk bs i found=0
  search="$json"
  while :; do
    case "$search" in
      *"\"$key\""*) search="${search#*\"$key\"}" ;;
      *) break ;;
    esac
    rest="$search"
    while :; do
      case "$rest" in
        [[:space:]]*) rest="${rest#?}" ;;
        *) break ;;
      esac
    done
    case "$rest" in
      :*) rest="${rest#:}"; found=1; break ;;
    esac
  done
  [ "$found" = 1 ] || return 1
  while :; do
    case "$rest" in
      [[:space:]]*) rest="${rest#?}" ;;
      *) break ;;
    esac
  done
  case "$rest" in
    \"*)
      rest="${rest#\"}"
      while :; do
        case "$rest" in
          *\"*) ;;
          *) return 1 ;;
        esac
        chunk="${rest%%\"*}"
        rest="${rest#*\"}"
        value="${value}${chunk}"
        bs=0
        i=$((${#chunk} - 1))
        while [ "$i" -ge 0 ] && [ "${chunk:$i:1}" = '\' ]; do
          bs=$((bs + 1))
          i=$((i - 1))
        done
        if [ $((bs % 2)) -eq 0 ]; then
          printf '%s' "$value"
          return 0
        fi
        value="${value}\""
      done
      ;;
    *)
      return 1
      ;;
  esac
}

# jq がない、または動かないときは、CommandLine の値に git と push を含む入力または CommandLine を取り出せない入力を拒否し、jq の導入などは通す。
# Antigravity の PreToolUse 契約では decision が必須で、"allow" は後続 hook / 既定ポリシーへ委譲する(自動承認は "auto_approve")。
if ! jq -n 1 >/dev/null 2>&1; then
  if ! command_value="$(extract_json_string "$input" CommandLine)" || [ -z "$command_value" ]; then
    echo '{"decision":"deny","reason":"hook の実行に jq が必要です。jq を入れてから実行してください。"}'
    exit 0
  fi
  case "$command_value" in
    *git*push*) echo '{"decision":"deny","reason":"hook の実行に jq が必要です。jq を入れてから実行してください。"}' ;;
    *) echo '{"decision":"allow"}' ;;
  esac
  exit 0
fi

hooks_dir="$(cd "$(dirname "$0")" && pwd)"

# 入力には直前のユーザー発言も含まれるため、実行するコマンドだけを判定に渡す。
# コマンドを取り出せない入力は判定できないので、許可せずに拒否する。
# 読めるのは toolCall.args.CommandLine の形だけ。入力の形が違うエージェントをつなぐときは、その形をここに足す。
if ! jq -e '.toolCall.args.CommandLine | select(type == "string" and length > 0)' <<<"$input" >/dev/null 2>&1; then
  echo '{"decision":"deny","reason":"hook が実行するコマンドを入力から取り出せませんでした。"}'
  exit 0
fi

# 共通の判定は Claude Code / Codex の入力の形で読む。
# 現在のブランチは toolCall.args.Cwd があればそれを優先し、なければトップレベルの cwd を使う。
if reason="$(jq -c '{tool_input: {command: .toolCall.args.CommandLine}, cwd: ((.toolCall.args.Cwd | if type == "string" and length > 0 then . else null end) // .cwd)}' <<<"$input" |
  bash "$hooks_dir/pre-tool-use-policy.sh" 2>&1 >/dev/null)"; then
  echo '{"decision":"allow"}'
else
  jq -cn --arg reason "$reason" '{decision: "deny", reason: $reason}'
fi
