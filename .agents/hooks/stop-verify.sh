#!/usr/bin/env bash
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
# ======= は Markdown の見出し下線にもなるので、他のマーカーがあるファイルでだけ数える。
# ファイル名は NUL 区切りで渡し、空白・引用符・先頭の : を含む名前も 1 つのパスとして扱う。
matches="$(git -C "$repo_root" --no-pager grep -z -l --untracked -E '^(<<<<<<<|>>>>>>>|\|\|\|\|\|\|\|)( |$)' -- ':!node_modules' 2>/dev/null |
  (cd "$repo_root" && xargs -0 -r git --literal-pathspecs --no-pager grep -n --untracked -E '^(<<<<<<<( |$)|>>>>>>>( |$)|\|\|\|\|\|\|\|( |$)|=======$)' -- 2>/dev/null) || true)"
if [ -n "$matches" ]; then
  echo "Conflict markers found:" >&2
  printf '%s\n' "$matches" >&2
  # 標準入力は Stop hook の JSON。一度止めた後の再停止まで止めると、誤検出のときにエージェントが終了できなくなる。
  input=""
  IFS= read -r -d '' -t 5 input || true
  [[ "$input" =~ \"stop_hook_active\"[[:space:]]*:[[:space:]]*true ]] && exit 0
  exit 2
fi

exit 0
