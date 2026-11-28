# アーキテクチャ

構成と判断の正本。書き方と更新の手順は `deciding-architecture` スキル（`.agents/skills/deciding-architecture/SKILL.md`）に従う。

## 原則

- 層にする I/O は、費用・Secret・データの持ち主・テストのしにくさに関わるものだけにする。その種類の I/O が初めて出たときに、層（ディレクトリと、入口のモジュール 1 つ）を作る。
- I/O の手段（Durable Object binding・SQLite ストレージ・fetch クライアント・Secret）は層の外に渡さない。層の外からは入口だけを使う。
- 守り方は、TypeScript の型境界（`tsconfig.json` / `tsconfig.worker.json` によるクライアント・Worker の分離）、自動テスト（`scripts/*.test.mjs` / `.agents/hooks/self-test.sh`）、レビューの順に選ぶ。
- フレームワーク・プラットフォームが I/O の置き場所を決めている箇所（`wrangler.jsonc` の Worker エントリポイントや Durable Object export）は例外とし、理由と一緒に「層と入口」の表に書く。
- UI 層は宣言的な React + React Router に限定し、状態管理・データ取得・UI コンポーネント集・CSS-in-JS などの追加ライブラリは入れない。テスト自動化の「的」として素直で予測可能な DOM・アクセシビリティ契約を優先する。
- **入れないもの（やらないこと）**：リポジトリ内の E2E テストスイート（教材・コース側で持つ方針）、追加の状態管理／データ取得／UI 部品／CSS-in-JS ライブラリ、外部データベースや秘密情報の保管。

## 構成

ブラウザ向けの React + React Router SPA（`src/`）と、Cloudflare Workers + Durable Objects（SQLite）の API バックエンド（`worker/`）を単一 Worker として配信する。`wrangler.jsonc` の `run_worker_first` により `/api/*` と `/health` のみを Worker が処理し、それ以外は SPA アセット（`index.html` フォールバック）を直接配信する。クライアントと Worker のデータ型契約は `worker/types.ts` を正本とし、`src/types.ts` が再エクスポートする。

| 役割 | 採用 | 備考 |
| --- | --- | --- |
| Runtime | Browser (ES2022) / Cloudflare Workers | 開発・ビルド・運用スクリプトは Node.js 24+ |
| Hosting | Cloudflare Workers | Static Assets + Worker + Durable Objects（Free プラン対応） |
| Framework | Vite 8 + React 19 + React Router v7 (`@cloudflare/vite-plugin`, `@vitejs/plugin-react`) | Declarative モードの軽量 SPA。状態管理・UI 部品ライブラリは入れない |
| Data | Cloudflare Durable Objects SQLite (`SessionDO`) | 訪問者セッション単位で分離（cookie `sid` または `X-Session-Id`、24 時間 TTL）。テーマは `localStorage` |
| Test | `node --test` (`scripts/*.test.mjs`) / `bash .agents/hooks/self-test.sh` | アプリ本体に E2E テストは置かない方針。型検査は `npm run typecheck`、デプロイ束確認は `wrangler deploy --dry-run` |

### 層と入口

| 層 | ディレクトリ | 入口 | 守るもの | 例外(理由) |
| --- | --- | --- | --- | --- |
| UI・画面 | `index.html`, `src/pages/`, `src/ui/`, `src/styles/`, `src/layout.ts`, `src/nav.ts`, `src/router.ts`, `src/theme.ts` | `src/main.ts` | `README.md` に定義した `role`・アクセシブル名・`data-testid`・共通シェル非汚染 | 段階移行中は現行ルーター／シェル上で一時ブリッジ `src/ui/mount-react.tsx` を介して React ページを描画する（Phase 3 で入口 `src/main.tsx` および共通シェル `src/shell/`・`src/auth.tsx` 分離へ切り替え予定）。`src/pages/unnamed.ts`（`src/pages/UnnamedPage.tsx` へ改名予定）は練習用に意図的にアクセシブル名を省く。純粋データ定義の `src/nav.ts`（他モジュール値 import・JSX・非 erasable 構文を持たない）と共通シェルおよび `src/styles/tokens.css` は契約検証のため `scripts/ui-contract.test.mjs` から直接参照する |
| クライアント API 通信 | `src/api.ts`, `src/auth.ts` | `src/api.ts` | `/api/*` 呼び出し、エラーハンドリング、認証状態の同期 | `src/auth.ts`（Phase 3 で `UI・画面` 層の `src/auth.tsx` へ分離予定）は共通ヘッダーの認証表示（`Sign in` リンク等）を担うため、契約検証（禁止ロール・リンク抽出）で `scripts/ui-contract.test.mjs` から直接参照する |
| 共有型契約 | `worker/types.ts`, `src/types.ts` | `worker/types.ts` | クライアント・Worker 間の DTO 整合 | なし |
| Worker HTTP API | `worker/index.ts`, `worker/api/` | `worker/index.ts` | セッション識別（cookie / `X-Session-Id`）、ルーティング、`Cache-Control: no-store` | `wrangler.jsonc` の `main` が `worker/index.ts` を直接指定するため、`SessionDO` クラスもここから再エクスポートする |
| セッション永続化 | `worker/session-do.ts`, `worker/seed.ts`, `worker/pdf.ts` | `worker/session-do.ts` | セッション単位の SQLite スキーマ・シード・24 時間自動削除 | Durable Object の `storage.sql` は `SessionDO` クラス内に閉じる |
| CI・ガバナンス | `scripts/`, `.agents/hooks/`, `.github/workflows/` | `scripts/dependabot-policy.mjs`, `.agents/hooks/` | Dependabot 自動マージ判定、UI 契約・WCAG コントラスト検証、force push 防止、コンフリクトマーカー検出 | なし |

**守り方**：
- `npm run typecheck` が `tsconfig.json`（ブラウザ DOM 型・`react-jsx`・`erasableSyntaxOnly`）と `tsconfig.worker.json`（Workers 型）を独立して検証し、クライアントから Workers 専用 API への依存、Worker への React 混入、および Node.js Type Stripping 非対応構文の混入を防ぐ。
- `node --test scripts/dependabot-policy.test.mjs`、`node --test scripts/ui-contract.test.mjs`、`bash .agents/hooks/self-test.sh` を PR CI（`.github/workflows/pr-ci.yml`）で毎回実行する。`scripts/ui-contract.test.mjs` が `MAIN_LINKS` 順序・ラベル・パス、全ナビゲーションリンク間の部分一致衝突、共通シェル（段階移行中は固定 4 ファイル `src/layout.ts` / `src/theme.ts` / `src/auth.ts` / `index.html`、Phase 3 で `src/shell/` 再帰走査＋`src/auth.tsx`＋JSX AST 走査へ拡張予定）への禁止ロール非混入、`src/styles/tokens.css` の WCAG AA / 1.4.11 コントラスト比・トークン網羅性・Dark 2 ブロック整合性を自動で守る。
- 静的ガードでは捕まえられない箇所（固定 4 ファイルの `SHELL_FILES` 外へ新規分割された共通シェル部品とその `SHELL_FILES` 追記漏れ、変数経由の間接的な属性付与、実 CSS で `CONTRAST_PAIRS` 未登録の既存トークン同士を組み合わせた新規前景/背景ペアと `CONTRAST_PAIRS` 追記漏れ、`src/styles/tokens.css` 外の直書き色、`opacity` 合成、各ページの `README.md` 個別契約、`src/pages/unnamed.ts`（`src/pages/UnnamedPage.tsx` へ改名予定）の無名仕様維持、`src/` から `worker/api/` 等への直接参照）は、`change-review` スキルの「UI・アクセシビリティ契約」観点と `README.md` 照合で守る。

## 後で決めること

- `mobile/` に予定している Expo 版アプリを追加する際のディレクトリ境界・API クライアント共有方針。

## 判断の記録

- 2026-11-27(repo-template 取り込み): 現行の Vite 8 + Vanilla TS SPA、Cloudflare Workers + Durable Objects (SQLite)、共有型 `worker/types.ts`、およびアプリ本体に E2E テストを置かず `scripts/*.test.mjs` (`node --test`) と `.agents/hooks/self-test.sh` で検証する構成を正本として記録。退けた案: フロントエンドフレームワーク導入、Vitest / `@mizchi/mutator` 導入（アプリを小さく保ちテスト対象の契約に集中する方針と合わないため不採用）。（※フロントエンドフレームワーク不採用の部分は 2026-11-28 の判断で置き換え）
- 2026-11-28(Issue #25): 保守性（手動 `esc()` による XSS リスクと手動クリーンアップの解消）および実務に近い React アプリとしての練習価値のため、`src/` を React 19 + React Router v7（Declarative モード）へ移行し、共通シェルを `src/shell/` に分離して `scripts/ui-contract.test.mjs` をディレクトリ走査＋JSX AST 解析へ拡張する。退けた案: Vanilla TS 維持（上記課題が解消しない）、Preact / TanStack Router / SSR フレームワーク導入（現実味・固定ルート規模・Worker 構成との整合性から不採用）。
