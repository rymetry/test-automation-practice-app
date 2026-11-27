#!/usr/bin/env bash
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
matches="$(git -C "$repo_root" --no-pager grep -n -E '^(<<<<<<<( |$)|>>>>>>>( |$)|\|\|\|\|\|\|\|( |$)|=======$)' -- ':!node_modules' 2>/dev/null || true)"
if [ -n "$matches" ]; then
  echo "Conflict markers found:" >&2
  printf '%s\n' "$matches" >&2
  exit 2
fi

exit 0
