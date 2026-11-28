# Agent Context

テスト自動化（UI / API / E2E）を練習するためのサンドボックスアプリ（Todo・UI 部品集）。フロントエンドは Vite 8 + React 19 + React Router v7 の SPA（`src/`）、バックエンドは Cloudflare Workers + Durable Objects SQLite（`worker/`）で構成され、訪問者ごとにセッションが分離される。リポジトリ内に E2E テストスイートは置かない方針。

## コマンド

- Dev server: `npm run dev`（`http://localhost:3000`、Vite と Cloudflare Worker が同時に起動）
- Typecheck: `npm run typecheck`（`src/` と `worker/` の両方を型チェック）
- Build: `npm run build`（クライアントと Worker を `dist/` にビルド）
- Policy tests: `node --test scripts/dependabot-policy.test.mjs`
- UI contract tests: `node --test scripts/ui-contract.test.mjs`
- Hook self-test: `bash .agents/hooks/self-test.sh`

## ルール

### 文章

- ドキュメント、コメント、返答は日本語で書く。識別子、テスト名、およびアプリ UI のロケータ対象文言（見出し、ボタン、ラベル、ステータスなど）は英語にする。
- 冗長にしない。人が読みやすく、AI が判断に迷わない粒度にとどめる。
- 検証結果には確認できた根拠を添える。未確認の点は未確認と明記する。

### テスト契約の保護

このアプリは外部の E2E / UI テスト自動化スイートの「的」として使われる。以下の契約を意図なく壊してはならない。

- `README.md` に定義された各画面の `role`、英語のアクセシブル名、`data-testid`、振る舞いを維持する。
- サイドバーの `MAIN_LINKS`（Home / Todos / Billing / Slow page / Ambiguous page）の項目・順序・ラベルを維持する。新規リンク追加時も既存リンク名と部分一致衝突しない名称にする。
- 共通シェル（サイドバー・トップバー・フッター）内に `status` / `region` / `dialog` ロールを置かない（ページ内の該当ロールをスコープ無しで指せる契約を守る）。
- `src/pages/UnnamedPage.tsx` は意図的にアクセシブル名を欠落させた練習ページであり、アクセシビリティ改善と称して修正しない。

### コーディング

- 実装は [ponytail](https://github.com/DietrichGebert/ponytail) に従う。プラグインがない環境でも次は守る。
  - 変更が届く範囲(呼び出し元・テスト・設定)を先に洗い出す。
  - 既存の部品、標準機能、導入済みの依存、最小限の新しいコードの順に選ぶ。頼まれていない機能・抽象化・依存は足さない。
  - 検証、データの保護、セキュリティ、アクセシビリティは削らない（ただし `src/pages/UnnamedPage.tsx` の意図的制約を除く）。
- 構成の正本は [docs/architecture/overview.md](docs/architecture/overview.md)。最初の土台を作る前、新しい種類の I/O(DB・外部 API・LLM など)を足す前、構造を変える前に `deciding-architecture` スキルを読む。overview.md の層と入口に反しないと実装できないときは、勝手に変えずに相談する。
- 命名は、名前から役割が分かるようにし、言語とフレームワークの慣習に従う。製品名・人名・チケット番号などの固有名詞を避け、内容や役割で名付ける。
- コメントには、コードから読み取れない理由だけを簡潔に書く。Issue 番号や変更の経緯は書かない(コミットと PR に書く)。
- テストコード（`scripts/*.test.mjs` など）を書く・直す前に `writing-tests` スキルを読む。条件の反転、境界値のずれ、処理の削除といった変異が入ったら失敗するテストにする。

### 作業の進め方

- `main` へ直接 push しない。変更は PR 経由で反映する。コミットの書き方は [CONTRIBUTING.md](CONTRIBUTING.md) に従う。
- 完了を報告する前に `npm run typecheck`、`npm run build`、および変更に関係する検証（`node --test scripts/dependabot-policy.test.mjs`、`node --test scripts/ui-contract.test.mjs`、`bash .agents/hooks/self-test.sh`）を実行し、結果を示す。
- PR を作る前に `ponytail-review` でセルフレビューする。
- 「レビューして」と依頼されたら `change-review` スキルに従う。

### 安全

- Secrets やローカル環境固有の状態をコミットしない。`.dev.vars` や `.env` / `.env.local` / `.env.*.local` などの実ファイルは読まず、コミット対象にも含めない。
- `main` への force push は禁止(hook でブロックされる)。
- コンフリクトマーカーを残したまま作業を終えない(hook で検出される)。

## 構成とエージェント配線

ルール・スキル・hook の正本を 1 か所に置き、各エージェントの設定はそれを参照する。

| | ルール | スキル | hook |
| --- | --- | --- | --- |
| **正本** | `AGENTS.md` | `.agents/skills/` | `.agents/hooks/` |
| **Claude Code** | `CLAUDE.md` が `AGENTS.md` を取り込む | `.claude/skills/` の相対シンボリックリンク | `.claude/settings.json` |
| **Codex** | `AGENTS.md` を直接読む | `.agents/skills/` を直接読む | `.codex/hooks.json` |
| **Antigravity** | `AGENTS.md` を直接読む | `.agents/skills/` を直接読む | `.agents/hooks.json` |

- コマンド実行前の hook はどのエージェントでも `jq` が必要。`jq` がない環境では `git push` を含むコマンドの実行が停止する。
- Antigravity に配線しているのはコマンド実行前の検査のみで、コンフリクトマーカーの検出（`stop-verify.sh`）は Claude Code と Codex で動く。
- スキルを足すときは `.agents/skills/<名前>/SKILL.md` を作り、`.claude/skills/<名前>` に `../../.agents/skills/<名前>` への相対シンボリックリンクを張る。

### 前提プラグイン

| プラグイン | 用途 | 対象 | 導入 |
| --- | --- | --- | --- |
| [ponytail](https://github.com/DietrichGebert/ponytail) | 実装とセルフレビューの方針(`ponytail`、`ponytail-review`) | すべてのエージェント | [INSTALL.md](https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md) |
| `pr-review-toolkit` | `change-review` スキルの担当エージェント | Claude Code | `/plugin install pr-review-toolkit@claude-plugins-official` |
