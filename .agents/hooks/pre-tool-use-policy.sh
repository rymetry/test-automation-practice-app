#!/usr/bin/env bash
# 標準入力は Claude Code / Codex の PreToolUse の JSON。他の形式は呼び出し側でこの形に直す。
# エージェントが普通に書く main への force push を、実行前に止める。
# 意図して回避する書き方(エイリアス、eval、変数やコマンド置換の中身など)は追わない。最後の守りは GitHub のブランチ保護に任せる。
set -uo pipefail

# jq を入れるコマンドも止めないよう、標準入力は外部コマンドを使わずに読む。
IFS= read -r -d '' input || true

# jq がない、または動かないときは、command の項目より後ろに git と push を含む入力だけを止め、jq の導入などは通す。
if ! jq -n 1 >/dev/null 2>&1; then
  case "${input#*\"command\"}" in *git*push*) echo "Blocked: hook の実行に jq が必要です。jq を入れてから実行してください。" >&2; exit 2 ;; esac
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
  local state=start force=0 targets_main=0 positionals=0 word destination
  for word in "$@"; do
    case "$state" in
      start)
        case "$word" in git|*/git) state=git ;; esac
        ;;
      git)
        case "$word" in
          -C|-c) state=git_option_value ;;
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
          --force*) force=1 ;;
          # すべてのブランチを送るので、main も宛先に含まれる。--mirror は force なしでも上書きする。
          --all|--branches) targets_main=1 ;;
          --mirror) force=1; targets_main=1 ;;
          -o|--push-option|--repo) state=push_option_value ;;
          --*) ;;
          # -uf のようにまとめた短いオプションも見る。
          -*) case "$word" in *f*) force=1 ;; esac ;;
          *)
            positionals=$((positionals + 1))
            # 最初の位置引数はリモートで、refspec はその後に続く。
            [ "$positionals" -gt 1 ] || continue
            case "$word" in +*) force=1; word="${word#+}" ;; esac
            destination="${word##*:}"
            # HEAD や、変数・コマンド置換の宛先は、現在のブランチを指すものとして扱う。
            case "$destination" in HEAD|@|*\$*) destination="$current_branch" ;; esac
            case "$destination" in main|heads/main|refs/heads/main) targets_main=1 ;; esac
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
