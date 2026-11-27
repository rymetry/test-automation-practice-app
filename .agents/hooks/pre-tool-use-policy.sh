#!/usr/bin/env bash
# 標準入力は Claude Code / Codex の PreToolUse の JSON。他の形式は呼び出し側でこの形に直す。
# エージェントが普通に書く main への force push を、実行前に止める。
# 意図して回避する書き方(エイリアス、eval、変数やコマンド置換の中身など)は追わない。最後の守りは GitHub のブランチ保護に任せる。
set -uo pipefail

# jq を入れるコマンドも止めないよう、標準入力は外部コマンドを使わずに読む。
IFS= read -r -d '' input || true

# jq がない環境でも外部コマンドを使わずに指定キーの JSON 値(文字列または配列)だけを取り出す。
# キーが見つからないか値が壊れているときは非 0 を返し、呼び出し側で安全側(ブロック)に倒す。
extract_json_field() {
  local json="$1" key="$2" search rest value="" chunk bs i len ch in_str=0 escaped=0 depth=1 found=0
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
    \[*)
      rest="${rest#\[}"
      len="${#rest}"
      i=0
      while [ "$i" -lt "$len" ]; do
        ch="${rest:$i:1}"
        if [ "$in_str" = 1 ]; then
          if [ "$escaped" = 1 ]; then
            escaped=0
          elif [ "$ch" = '\' ]; then
            escaped=1
          elif [ "$ch" = '"' ]; then
            in_str=0
          fi
        else
          case "$ch" in
            '"') in_str=1 ;;
            '[') depth=$((depth + 1)) ;;
            ']')
              depth=$((depth - 1))
              if [ "$depth" -eq 0 ]; then
                printf '%s' "$value"
                return 0
              fi
              ;;
          esac
        fi
        value="${value}${ch}"
        i=$((i + 1))
      done
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

# jq がない、または動かないときは、command の値に git と push を含む入力または command を取り出せない入力を止め、jq の導入などは通す。
if ! jq -n 1 >/dev/null 2>&1; then
  if ! command_value="$(extract_json_field "$input" command)"; then
    echo "Blocked: hook の実行に jq が必要です。jq を入れてから実行してください。" >&2
    exit 2
  fi
  case "$command_value" in *git*push*) echo "Blocked: hook の実行に jq が必要です。jq を入れてから実行してください。" >&2; exit 2 ;; esac
  exit 0
fi

# cwd などコマンド以外の項目で誤判定しないよう、実行するコマンドだけを見る。
# 引数の配列で渡されたコマンドは 1 行につなぎ、行継続(バックスラッシュと改行)もつなぐ。
command_line="$(jq -r '[.tool_input.command // empty] | flatten | join(" ") | gsub("\\\\\n"; " ")' <<<"$input" 2>/dev/null)" ||
  { echo "Blocked: hook の入力を JSON として読めません。" >&2; exit 2; }

# 宛先を書かない push は現在のブランチへ向かうので、コマンドを実行する場所のブランチを調べる。
# 短縮した参照名(symbolic-ref --short)は、同じ名前のタグがあると heads/main になるので使わない。
current_branch="$(git -C "$(jq -r '.cwd // "."' <<<"$input")" branch --show-current 2>/dev/null)"
# ブランチが分からないとき(detached HEAD、古い git など)は、見逃さないよう main とみなす。
current_branch="${current_branch:-main}"

# 単純コマンド 1 つ分の単語を受け取り、main への force push なら 0 を返す。
is_force_push_to_main() {
  local state=start force=0 targets_main=0 positionals=0 word destination prefix
  for word in "$@"; do
    case "$state" in
      start)
        case "$word" in git|*/git) state=git ;; esac
        ;;
      git)
        case "$word" in
          -C|-c|--git-dir|--work-tree|--namespace|--config-env) state=git_option_value ;;
          -*) ;;
          push) state=push ;;
          # コミットメッセージなど、push 以外のサブコマンドの引数は判定しない。
          *) return 1 ;;
        esac
        ;;
      git_option_value) state=git ;;
      push_option_value) state=push ;;
      push)
        case "$word" in
          # 削除も履歴を失う点で force push と同じに扱う。
          --force*|--delete) force=1 ;;
          # すべてのブランチを送るので、main も宛先に含まれる。--mirror は force なしでも上書きする。
          --all|--branches) targets_main=1 ;;
          --mirror) force=1; targets_main=1 ;;
          -o|--push-option|--repo|--receive-pack|--exec) state=push_option_value ;;
          --*) ;;
          # -o<value> は短いオプションの連結ではなく push option の値なので、値に含まれる f で誤判定しない。
          -o*) ;;
          # -uf のようにまとめた短いオプションも見る。o の後ろは push option の値なので、o より前だけを見る。
          # -fo のように o が末尾なら、次の単語が値になる。
          -*)
            case "${word%%o*}" in *[fd]*) force=1 ;; esac
            case "$word" in *o*) [ -n "${word#*o}" ] || state=push_option_value ;; esac
            ;;
          *)
            positionals=$((positionals + 1))
            # 最初の位置引数はリモートで、refspec はその後に続く。
            [ "$positionals" -gt 1 ] || continue
            # :main のような送信元のない refspec は宛先の削除。
            case "$word" in +*) force=1; word="${word#+}" ;; :?*) force=1 ;; esac
            destination="${word##*:}"
            # HEAD や、変数・コマンド置換の宛先は、現在のブランチを指すものとして扱う。
            case "$destination" in HEAD|@|*\$*) destination="$current_branch" ;; esac
            # 空の宛先(: の matching refspec)と、* より前が main の参照名の先頭に一致するワイルドカードは main を含みうる。
            case "$destination" in
              ''|main|heads/main|refs/heads/main) targets_main=1 ;;
              *\**)
                prefix="${destination%%\**}"
                case "main heads/main refs/heads/main" in "$prefix"*|*" $prefix"*) targets_main=1 ;; esac
                ;;
            esac
            ;;
        esac
        ;;
    esac
  done

  [ "$force" = 1 ] || return 1
  [ "$targets_main" = 1 ] || { [ "$positionals" -le 1 ] && [ "$current_branch" = main ]; }
}

# 単語に分けるときに * などがファイル名へ展開されないようにする。
set -f

# shortcut: 引用符を外し、区切り記号と空白で分けるだけで、変数の値・エイリアス・コマンド置換の中身・cd や -C の移動先は追わない。
# git より前の単語は読み飛ばすので、echo や rg の引数、引用した文字列の中に force push の文言があっても止める。
# 普通の書き方の見落としが問題になったら、シェルの構文解析に置き換える。
while IFS= read -r simple_command; do
  # shellcheck disable=SC2086 # 単語に分けるために引用符を付けない。
  if is_force_push_to_main $simple_command; then
    echo "Blocked: force push to main is not allowed." >&2
    exit 2
  fi
done < <(
  # リダイレクトは引数の間にも書けるので、refspec に数えないよう区切る前に取り除く。
  printf '%s\n' "$command_line" | tr -d "\"'" |
    sed -E 's/[0-9]*&?[<>]+&?[[:space:]]*[^[:space:];&|()]*//g' |
    tr ';&|()`' '\n'
)

exit 0
