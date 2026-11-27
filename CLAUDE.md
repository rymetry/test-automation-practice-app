@AGENTS.md

## Claude Code 固有

- スキルは `.claude/skills/<名前>` から `.agents/skills/<名前>` へのシンボリックリンクで読み込む。スキルを足したらリンクも足す。
- hook の配線は `.claude/settings.json`。スクリプト本体は `.agents/hooks/`。
