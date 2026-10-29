# test-automation-practice-app

テスト自動化を練習するための、わざと小さく作った Todo アプリです。UI テスト、API テスト、エージェント型の E2E テストなど、フレームワークを問わず「的」として使えます（Playwright、Cypress、[TesterArmy の e2e](https://e2e.tester.army/docs)、Maestro など）。

- **訪問者ごとにセッションが分離**されます。自分の todo・ログイン状態・プランは他の人と混ざらず、`POST /api/reset` も自分のセッションだけを初期化します。
- マークアップは**セマンティック優先**（どのツールでも `getByRole` / `getByLabel` が効く）で、主要な要素には `data-testid` も付けています。
- 特定のテスト課題を練習するためだけのページがあります。描画が遅いページと、同じ名前のボタンが 2 つあるページです。
- このリポジトリに E2E テストは置きません。アプリを使う教材やコースが、それぞれの側でテストを持ちます。

**公開 URL:** https://test-automation-practice-app.test-automation-practice-app.workers.dev

## 起動する

Node.js 24 以上が必要です。

```bash
npm install
npm run dev        # http://localhost:3000（Vite と Cloudflare Worker がどちらもローカルで動く）
```

その他のスクリプト:

| スクリプト | 内容 |
| --- | --- |
| `npm run build` | クライアントと Worker を `dist/` にビルド |
| `npm run preview` | 本番ビルドをローカルの 3000 番で配信 |
| `npm run typecheck` | `src/`（ブラウザ）と `worker/`（Workers ランタイム）を型チェック |
| `npm run deploy` | ビルドして Cloudflare Workers にデプロイ（事前に `npx wrangler login` が 1 回必要） |

## 画面（テストから見た仕様）

すべての画面に共通のヘッダーがあり、**Main** という名前の `navigation` に **Home** / **Todos** / **Billing** / **Slow page** / **Ambiguous page** のリンクがあります。加えて、未ログインなら **Sign in** リンク、ログイン中なら "Signed in as alice" のテキストと **Sign out** ボタン（`data-testid="sign-out"`）が出ます。ドキュメントタイトルは `<ページ名> · Todo App` です。UI の文言は、各フレームワークのドキュメントの例と揃えるため英語にしています。

| ルート | 要素（ロール "名前"） | `data-testid` | 振る舞い |
| --- | --- | --- | --- |
| `/` | `heading` "Todo App" | | 入口ページ。 |
| `/todos` | `textbox` "New todo"、`button` "Add"、`group` "Filter" の中に `radio` "All" / "Active" / "Completed"、`list` "Todos" の中の `listitem`（それぞれ todo 名の `checkbox` と `button` "Delete"）、`status` "N remaining" | `new-todo-form`, `new-todo-input`, `add-todo`, `filters`, `todo-list`, `todo-item`, `delete-todo`, `remaining` | 空のまま送信しても何も起きない。チェックすると "N remaining" が減る。ログイン不要。 |
| `/login` | `textbox` "Username"、`textbox` "Password"（type=password）、`button` "Sign in"。失敗時は `alert` "Invalid username or password" | `login-form`, `username`, `password`, `sign-in`, `login-error` | 成功すると `/todos` へ移動し、ヘッダーが "Signed in as alice" になる。 |
| `/settings/billing` | `status` "Current plan: Free"（または "Pro"）、`button` "Upgrade to Pro"、"Upgrade to Pro?" という見出しの `dialog` に `button` "Confirm" と `button` "Cancel" | `plan`, `plan-name`, `upgrade`, `upgrade-dialog`, `confirm-upgrade`, `cancel-upgrade` | 未ログインなら `/login` へリダイレクト。Confirm で status が "Pro" になり、Upgrade ボタンが消える。 |
| `/slow` | 2 秒間 `status` "Loading…"、その後 `heading` "Loaded" | `loading`, `loaded` | sleep ではなく明示的な待機を練習するためのページ。 |
| `/ambiguous` | "Drafts" と "Published" の 2 つの `region`、それぞれに `button` "Delete"。`status` にどちらを押したかが出る | `drafts`, `published`, `delete-draft`, `delete-published`, `ambiguous-result` | 複数要素に一致してしまうロケータを練習するためのページ。 |
| それ以外 | `heading` "Page not found" | | クライアント側の 404。 |

ログインできるアカウントは **alice / password123** だけです。意図的に公開しています。このアプリには秘密にすべきものがありません。

## API

すべてのリクエストはセッション（後述）に紐づきます。レスポンスは JSON で、`Cache-Control: no-store` が付きます。

| メソッドとパス | ボディ | レスポンス |
| --- | --- | --- |
| `POST /api/session` | | `201 { sid }`。cookie `sid` を設定する。常に**新しい**セッションを開始する。 |
| `GET /api/todos` | | `200 Todo[]` |
| `POST /api/todos` | `{ title }` | `201 Todo`。タイトルが空なら `400 { error }` |
| `PATCH /api/todos/:id` | `{ done?: boolean, title?: string }` | `200 Todo`、`400`、または `404` |
| `DELETE /api/todos/:id` | | `204`、または `404` |
| `POST /api/login` | `{ username, password }` | `200 { username }`、または `401 { error: "Invalid username or password" }` |
| `POST /api/logout` | | `204` |
| `GET /api/me` | | `200 { username: "alice" }` または `200 { username: null }` |
| `GET /api/billing` | | `200 { plan: "Free" \| "Pro" }`。未ログインなら `401` |
| `POST /api/billing/upgrade` | | `200 { plan: "Pro" }`。未ログインなら `401` |
| `POST /api/reset` | | `204`。todo を消し、ログアウトし、Free プランに戻す。**自分のセッションだけ。** |
| `GET /health` | | `200 { ok: true, version }` |

`Todo` は `{ id: number, title: string, done: boolean, createdAt: number }` です。未知の `/api/*` パスは `404`、メソッド違いは `Allow` ヘッダー付きの `405` を返します。

### セッション

- セッションを持たない最初の `/api/*` リクエストに `Set-Cookie: sid=<uuid>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` が返ります。
- ヘッダー `X-Session-Id: <sid>` でもセッションを指定できます。ブラウザのセッションを API テストと共有したり（`browser.cookies()` → ヘッダー）、API テストが自分専用のセッションを持ったりするときに使います。
- **24 時間**リクエストが無いセッションは自動で削除されます。
- セッションごとに SQLite ストレージを持つ Durable Object が 1 つあり、セッション間で共有されるものはありません。

```bash
# シェルから独立した 2 つのセッションを作る例
curl -s -c a.txt -X POST http://localhost:3000/api/session
curl -s -b a.txt -X POST http://localhost:3000/api/todos -H 'Content-Type: application/json' -d '{"title":"Write the release notes"}'
curl -s -b a.txt http://localhost:3000/api/todos         # todo が 1 件
curl -s -c b.txt http://localhost:3000/api/todos         # [] 別のセッションなので空
```

## テストスイートから使う

- テストの向き先は `http://localhost:3000`（このフォルダで `npm run dev`）か、公開 URL にします。アプリを自分で起動できるテストランナーなら、このフォルダで `npm run dev` を実行させれば済みます。
- 各テストは `POST /api/reset` でまっさらな状態から始めるか、`POST /api/session` で新しいセッションを開きます。
- 新しいブラウザコンテキストは自動的に新しいセッションになるので、後片付けは要りません。
- ロケータは `getByRole` / `getByLabel` を優先し、必要なら上の表の `data-testid` にフォールバックしてください。

## デプロイ

アプリは Cloudflare Worker 1 つです。静的アセットと、Worker が処理する `/api/*` と `/health`、状態を持つ Durable Objects（SQLite 型、Workers Free プランで利用可能）で構成されています。

```bash
npx wrangler login      # 1 回だけ
npm run deploy          # → https://test-automation-practice-app.test-automation-practice-app.workers.dev
```

## プロジェクト構成

```
index.html, src/        クライアント。history ベースの小さな SPA、ページごとに 1 モジュール、フレームワーク無し
worker/index.ts         Worker。cookie、ルーティング、JSON API、それ以外は静的アセットへフォールバック
worker/session-do.ts    訪問者 1 人分の todo・ユーザー・プランを持つ Durable Object
wrangler.jsonc          Worker の設定。SPA 用のアセット配信、run_worker_first、Durable Object のバインディング
vite.config.ts          Vite と @cloudflare/vite-plugin（Worker が dev サーバーの中で動く）
```

予定: `mobile/` に同じ Todo アプリの Expo 版を追加し、デバイス上でのテスト練習に使う（デプロイ対象外）。

## ライセンス

[MIT](LICENSE)
