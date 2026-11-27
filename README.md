# test-automation-practice-app

テスト自動化を練習するための、わざと小さく作った Todo アプリです。UI テスト、API テスト、エージェント型の E2E テストなど、フレームワークを問わず「的」として使えます（Playwright、Cypress、[TesterArmy の e2e](https://e2e.tester.army/docs)、Maestro など）。

- **訪問者ごとにセッションが分離**されます。自分の todo・ログイン状態・プランは他の人と混ざらず、`POST /api/reset` も自分のセッションだけを初期化します。
- マークアップは**セマンティック優先**（どのツールでも `getByRole` / `getByLabel` が効く）で、主要な要素には `data-testid` も付けています。
- 特定のテスト課題を練習するためだけのページがあります。描画が遅いページと、同じ名前のボタンが 2 つあるページです。
- Bondar Academy の playground にあるような **UI 部品のページ**（フォーム、datepicker、ダイアログ、ポップオーバー、トースト、ツールチップ、編集できる表、ツリー、ドラッグ＆ドロップ、グラフ、登録とパスワード再設定、ファイルのダウンロードとアップロード）があります。playground と違い、すべての部品に正しいアクセシビリティ名が付いていて、状態を持つ部品は同じデータを API からも読めます。名前の無い部品だけを集めたページが 1 つだけあります。
- このリポジトリに E2E テストは置きません。アプリを使う教材やコースが、それぞれの側でテストを持ちます。

**公開 URL:** https://test-automation-practice-app.rymetry.workers.dev

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

すべての画面に共通の**サイドバー**、**トップバー**、**フッター**があります。サイドバー（`complementary`）には `link` "Todo App"（`/` へ）、**Main** という名前の `navigation` に **Home** / **Todos** / **Billing** / **Slow page** / **Ambiguous page** のリンク、**Components** という名前の `navigation` に部品ページへのリンク（下の表のページ名がそのままリンク名）があります。トップバー（`banner`）には現在ページのセクションとページ名の表示（`data-testid="header-context"`、幅 640px 未満では非表示。ナビのグループ名とリンク名、`/login` は "Account / Sign in"、それ以外は "Workspace / Page not found"。h1 と同じ文字列になるので、テキストで指すときは `main` にスコープする）、`button` "Dark mode"（`data-testid="theme"`。名前は状態によらず固定で、`aria-pressed` は表示中のテーマがダークなら `true`。未設定時は OS の `prefers-color-scheme` に従い、クリックで Light / Dark を切り替えて `localStorage` の `theme` に保存。OS 設定に従う状態へはアプリ内から戻せない）、未ログインなら **Sign in** リンク（`data-testid="sign-in-link"`）、ログイン中なら "Signed in as alice" のテキストと **Sign out** ボタン（`data-testid="sign-out"`）が出ます。フッター（`contentinfo`）にはアプリの説明、著作権表示、`link` "GitHub repository"（`data-testid="github-link"`、外部の github.com を新しいタブで開く）があります。幅 900px 未満ではサイドバーが隠れ、`button` "Open menu" で開きます。Escape か背景のクリックで閉じ、Escape ではフォーカスが "Open menu" に戻ります。ドキュメントタイトルは `<ページ名> · Todo App` です。共通部分には `status` / `region` / `dialog` を置いていないので、ページ内のそれらをスコープ無しで指せます。ロケータの名前になる文言（見出し、ボタン、ラベル、ステータス）は各フレームワークのドキュメントの例と揃えるため英語、説明の段落は日本語です。

| ルート | 要素（ロール "名前"） | `data-testid` | 振る舞い |
| --- | --- | --- | --- |
| `/` | `heading` "Todo App"、`list` "Pages" の `listitem` に各ページへの `link`（名前は「ページ名 + 説明」なのでサイドバーのリンクとは別） | `pages` | 入口ページ。 |
| `/todos` | `textbox` "New todo"、`button` "Add"、`group` "Filter" の中に `radio` "All" / "Active" / "Completed"、`list` "Todos" の中の `listitem`（それぞれ todo 名の `checkbox` と `button` "Delete"）、`status` "N remaining" | `new-todo-form`, `new-todo-input`, `add-todo`, `filters`, `todo-list`, `todo-item`, `delete-todo`, `remaining` | 空のまま送信しても何も起きない。チェックすると "N remaining" が減る。ログイン不要。 |
| `/login` | `textbox` "Username"、`textbox` "Password"（type=password）、`button` "Sign in"。失敗時は `alert` "Invalid username or password" | `login-form`, `username`, `password`, `sign-in`, `login-error` | 成功すると `/todos` へ移動し、ヘッダーが "Signed in as alice" になる。 |
| `/settings/billing` | `status` "Current plan: Free"（または "Pro"）、`button` "Upgrade to Pro"、"Upgrade to Pro?" という見出しの `dialog` に `button` "Confirm" と `button` "Cancel" | `plan`, `plan-name`, `upgrade`, `upgrade-dialog`, `confirm-upgrade`, `cancel-upgrade` | 未ログインなら `/login` へリダイレクト。Confirm で status が "Pro" になり、Upgrade ボタンが消える。 |
| `/slow` | 2 秒間 `status` "Loading…"、その後 `heading` "Loaded" | `loading`, `loaded` | sleep ではなく明示的な待機を練習するためのページ。 |
| `/ambiguous` | "Drafts" と "Published" の 2 つの `region`、それぞれに `button` "Delete"。`status` にどちらを押したかが出る | `drafts`, `published`, `delete-draft`, `delete-published`, `ambiguous-result` | 複数要素に一致してしまうロケータを練習するためのページ。 |
| `/forms/layouts` | 5 つの `form`（"Inline form" / "Using the grid" / "Basic form" / "Block form" / "Horizontal form"）。中に `textbox` "Name" / "Email" / "First name" / "Last name" / "Website"、"Password"（type=password）、`checkbox` "Remember me" / "Check me out"、`group` "Option" の `radio` "Option 1" / "Option 2"、`button` "Submit" または "Sign in"。検証エラーは `alert`（"Name is required"、"Email must contain @"、"Password must be at least 8 characters"）、送信後は同じ form 内の `status` "Submitted: key=value, …" | `form-<id>`, `form-<id>-error`, `form-<id>-result`（id は inline / grid / basic / block / horizontal） | 同じ "Email" が 5 つあるので form の名前でスコープする。送信内容は `POST /api/forms/:form` に保存され、リロード後も status に残る。 |
| `/forms/datepicker` | `group` "Date" / "Start date" / "End date" / "Date with limits"。それぞれ読み取り専用の `textbox`（同名）と `button` "Choose date"（`aria-expanded`）。開くと `dialog` "Choose date" に `button` "Previous month" / "Next month"、月名のテキスト、`grid` の `gridcell` に `button`（表示は日、名前は "15 November 2026" 形式） | `date`, `start-date`, `end-date`, `limited-date`, `<id>-month` | 値は `YYYY-MM-DD`。End date は Start date より前が無効。Date with limits は今日の前後 7 日以外が `disabled`。Esc と外側クリックで閉じる。 |
| `/controls/tabs` | `tablist` "Sections" の `tab` "Overview" / "Specs" / "Changelog"（`aria-selected` / `aria-controls`）と対応する `tabpanel`。アコーディオンの `button`（`aria-expanded`："What is session isolation?" / "How do I reset state?" / "Which locators should I use?"）と `region` パネル。結果の `status`（"Selected tab: <タブ名>" / "Expanded: <見出し>" / "Collapsed: <見出し>"） | `tabs-list`, `tab-overview`, `tab-specs`, `tab-changelog`, `tabpanel-overview`, `tabpanel-specs`, `tabpanel-changelog`, `accordion`, `accordion-trigger-1..3`, `accordion-panel-1..3`, `controls-tabs-result` | クライアント完結（リロードで初期化）。タブはクリックと左右矢印・Home・End キーで自動切替。アコーディオンは先頭のみ初期展開で複数同時展開可。 |
| `/controls/inputs` | `combobox` "Country"（`aria-expanded` / `aria-activedescendant`）と `listbox` "Country suggestions" 内の `option`（10 カ国）、`switch` "Email notifications"（初期 `true`）/ "Auto-save"（初期 `false`）、`slider` "Timeout (seconds)"（0〜60、5 刻み、初期 30）、`button` "Apply settings"、`status`（"Applied: key=value, …"） | `controls-form`, `country-combobox`, `country-listbox`, `switch-notifications`, `switch-autosave`, `slider-timeout`, `slider-timeout-value`, `apply-controls`, `controls-result` | クライアント完結（リロードで初期化）。入力で候補を絞り込み、上下矢印＋Enter またはクリックで選択。Esc や外側クリックで候補を閉じる。 |
| `/overlays/dialog` | `button` "Open dialog" / "Open dialog with backdrop close" / "Open dialog without Esc" / "Enter name"。`dialog` "Dialog" / "Dialog with backdrop close" / "Dialog without Esc"（それぞれ `button` "Close"）、`dialog` "Enter your name"（`textbox` "Name"、`button` "Submit" / "Cancel"）。結果は `status` | `open-dialog`, `open-backdrop-dialog`, `open-no-esc-dialog`, `open-name-dialog`, `dialog-basic`, `dialog-backdrop`, `dialog-no-esc`, `dialog-name`, `dialog-result` | status は "Closed by button" / "Closed by backdrop" / "Closed by Escape" / "Cancelled" / "Hello, <name>"。閉じている dialog は画面ツリーに出ない。 |
| `/overlays/window` | `button` "Open window form" / "Open window with text"。非モーダルの `dialog` "Window form"（`textbox` "Subject" / "Text"、`button` "Send"）と `dialog` "Window with text"。各ウィンドウのタイトルバーに `button` "Minimize"（`aria-pressed`）/ "Maximize"（`aria-pressed`）/ "Close"。結果は `status` | `open-window-form`, `open-window-text`, `window-form`, `window-text`, `window-result` | 2 つ同時に開ける。Send で status が "Sent: <subject>" になりウィンドウが閉じる。 |
| `/overlays/popover` | `button` "Top" / "Right" / "Bottom" / "Left"（`aria-expanded`。開くと `dialog` "Popover" に "Hello, how are you today?"）、`button` "Show on hover"（`tooltip` "Popover on hover"）、`button` "Open form popover"（`dialog` "Send a message" に `textbox` "Recipients" / "Subject" / "Message"、`button` "Send"）。結果は `status` | `popover-<placement>`, `popover-hover`, `popover-form`, `popover-result` | ブラウザ標準の Popover API。同時に開くのは 1 つ。Send で status が "Sent to <recipients>"。 |
| `/overlays/toastr` | `combobox` "Position" / "Type"、`textbox` "Title" / "Message"、`spinbutton` "Duration (ms)"、`checkbox` "Prevent duplicates"、`button` "Show toast" / "Random toast"。トーストは `status`（Type が danger なら `alert`）で、中に `button` "Dismiss" | `toast-form`, `show-toast`, `random-toast`, `toasts`, `toast` | Duration 後に消える（0 なら残る）。同じトーストを 2 回出すと `status` が 2 つになる。 |
| `/overlays/tooltip` | `button` "Top" / "Right" / "Bottom" / "Left" / "With icon"。hover か focus で `tooltip`（"Tooltip on top" など、"This is a tooltip"）が出て `aria-describedby` で結ばれる | `tooltip-<placement>`, `tooltip-icon` | 出ていない tooltip は画面ツリーに無い。Esc で隠れる。 |
| `/overlays/browser` | `region` "Native alerts & prompts" に `button` "Trigger alert" / "Trigger confirm" / "Trigger prompt" と `status`、`region` "New tab" に `link` "Open in new tab"（`target="_blank" rel="noopener noreferrer"`） | `trigger-alert`, `trigger-confirm`, `trigger-prompt`, `browser-alert-result`, `open-new-tab` | クライアント完結。ブラウザ標準の `alert` / `confirm` / `prompt` の結果が status（"Alert acknowledged" / "Confirmed" / "Dismissed" / "Entered: <text>" / "Entered: (empty)" / "Cancelled"）に出る。別タブ遷移は `context.waitForEvent('page')` 等で捕捉する。 |
| `/new-tab` | `heading` "New tab page"、`status` "Opened in a new tab"、`link` "Back to alerts" | `new-tab-status` | `/overlays/browser` の "Open in new tab" から別タブで開かれる補助ページ（共通シェル付き）。 |
| `/tables/smart-table` | `button` "Add new" / "Clear filters"、`table` "Contacts"（列 ID / First name / Last name / Username / Email / Age / Actions）。列見出しに `button` "Sort by <列名>"（`th` の `aria-sort`）、2 行目に `textbox` "Filter by <列名>"。各行は `row` で、`button` "Edit" / "Delete"。編集行には `textbox` "First name" / "Last name" / "Username" / "Email"、`spinbutton` "Age"、`button` "Create"（新規）または "Save"、"Cancel"。Delete は `dialog` "Delete this contact?" の `button` "Confirm" / "Cancel"。`navigation` "Pagination" に `button` "Previous page" / "Page N"（現在は `aria-current`）/ "Next page" | `add-new`, `clear-filters`, `contacts`, `contact-row`, `new-contact-row`, `edit-contact-row`, `contact-error`, `page-summary`, `delete-dialog`, `delete-target`, `confirm-delete`, `cancel-delete` | 初期 12 件（10 件ずつ 2 ページ）。絞り込みは部分一致、並べ替えは昇順 → 降順 → 無し。`GET /api/contacts` と同じデータ。 |
| `/tables/tree-grid` | `textbox` "Filter"、`tree` "Files" の `treeitem`（"Projects" / "Reports" / "Other" と配下のファイル。フォルダは `aria-expanded`、`aria-level` 付き） | `tree-filter`, `file-tree`, `tree-item` | クリック、Enter、→ / ← で開閉、↑ / ↓ で移動。絞り込むと一致した項目の親が開く。固定データ。 |
| `/board` | `textbox` "New card"、`combobox` "Column"、`button` "Add card"。`list` "To do" / "In progress" / "Done" の `listitem`（カード。`draggable`）に `button` "Move left" / "Move right"（端の列では `disabled`）/ "Delete" | `new-card-form`, `add-card`, `board-error`, `column-todo`, `column-doing`, `column-done`, `card` | ドラッグ＆ドロップでも、ボタンでも動く。`GET /api/board` と同じ並び。初期 6 枚。 |
| `/charts` | `button` "Reload"、`img` "Contacts by age group"（SVG 棒グラフ）と `table` "Contacts by age group"（Age group / Contacts）、`img` "Cards by column"（SVG 円グラフ）と `table` "Cards by column"（Column / Cards） | `reload-charts`, `age-chart`, `column-chart` | 値は `GET /api/metrics`。テストは table か API で確かめる。 |
| `/auth/register` | `textbox` "Full name" / "Email" / "Username"、"Password" / "Repeat password"（type=password）、`checkbox` "Agree to Terms & Conditions"、`button` "Register"、`link` "Already have an account? Sign in"。エラーは `alert`（"Passwords do not match"、"You must agree to the terms"、"Username is already taken"、"Email is already taken" など） | `register-form`, `register-error`, `register` | 成功するとサインイン済みで `/todos` へ。アカウントはそのセッションにだけ存在し、`/login` で使える。 |
| `/auth/request-password` | `textbox` "Email"、`button` "Request password"。成功で `status` "Reset token: <token>" と `link` "Continue to reset password"。失敗は `alert` "No account with that email" | `request-password-form`, `request-error`, `request-password`, `request-result`, `reset-token` | メールは送らず、トークンを画面に出す。alice のメールは `alice@example.com`。 |
| `/auth/reset-password` | `textbox` "Token"（`?token=` で埋まる）、"New password" / "Confirm password"（type=password）、`button` "Change password"。成功で `status` "Password changed" と `link` "Back to sign in"。失敗は `alert` | `reset-password-form`, `reset-error`, `change-password`, `reset-result` | 以後その新しいパスワードでサインインできる（`POST /api/reset` で元に戻る）。 |
| `/files` | `link` "Download invoice (PDF)" / "Download contacts (CSV)"、ファイル入力 "Upload a file"、`button` "Upload"、`list` "Uploaded files" の `listitem`（"名前 (サイズ)" と `button` "Delete"）。ファイル未選択の送信は `alert` "Choose a file first" | `download-invoice`, `download-contacts`, `upload-form`, `upload-input`, `upload`, `upload-error`, `uploaded-files`, `uploaded-file`, `no-files` | 請求書 PDF は未サインインだと `401`。アップロードは名前とサイズだけ保存する。 |
| `/practice/frames` | `region` "Embedded iframe"（`iframe` title "Embedded form" と `status` "Iframe status"）、`region` "Shadow DOM"（Open Shadow DOM 内の `textbox` "Shadow input"・`button` "Apply shadow"・`status` "Shadow status"） | `embedded-frame`, `frame-parent-result`, `shadow-host`, `shadow-form`, `shadow-input`, `shadow-apply`, `shadow-result` | クライアント完結（リロードで初期化）。2 つの名前付き `region` と `status` の `aria-label` でスコープ分離。iframe 内の送信は `postMessage` で親の "Iframe status" に反映される。Shadow input を空のまま Apply shadow すると "Shadow status" が "Shadow input is required" になる。 |
| `/embed/form` | `heading` "Embedded form"、`textbox` "Frame note"、`button` "Send from frame"、`status` "Embedded form status" | `frame-form`, `frame-note`, `frame-send`, `frame-result` | `/practice/frames` から埋め込まれる専用補助ルート（共通シェル無し・`/api/me` 不発火）。空でない Frame note の送信時だけ同一オリジンの親へ `postMessage` を送る。空なら "Embedded form status" が "Frame note is required" になり、親には送らない。 |
| `/practice/dynamic` | 3 つの名前付き `region`："Delayed enable"（`button` "Enable action" / "Run action"、`status` "Delayed action status"）、"Job progress"（`button` "Start job"、`progressbar` "Job progress"、`status` "Job status"）、"Infinite feed"（`list` "Feed items"、`button` "Load more"、件数テキスト） | `enable-action`, `delayed-action`, `delayed-result`, `start-job`, `job-progress`, `job-result`, `feed-container`, `feed-list`, `feed-item`, `load-more`, `feed-count` | クライアント完結（リロードで初期化）。Enable action は 1.5 秒後に Run action を有効化（待機中は Enable action 自身も disabled）。Start job は実行中 disabled で、 1.5 秒（300ms×5）で `aria-valuenow="100"` になり "Job completed"。Feed は初期 10 件、スクロール下端到達または Load more で 10 件ずつ最大 50 件まで追加。 |
| `/unnamed` | **わざと名前の無い部品だけ**: `aria-label` 無しのアイコン `button` 3 つ、ラベル無し（placeholder "Search..." だけ）の `textbox`、`div` で作ったボタン、見出しの無い `table`、`href` 無しの `<a>`、role 無しの結果表示 | `fake-button`, `unnamed-result` | 名前以外の手がかり（順番、テキスト、test id、親からの絞り込み）で指す練習用。 |
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
| `POST /api/register` | `{ fullName, email, username, password }` | `201 { username }` でサインイン済みになる。空欄・`@` の無い email・8 文字未満の password・`^[a-z0-9_]{3,20}$` 以外の username は `400 { error }`。username が alice か登録済みなら `409 { error: "Username is already taken" }`、email が登録済み（alice のものを含む）なら `409 { error: "Email is already taken" }` |
| `POST /api/password/request` | `{ email }` | `200 { token }`、または `404 { error: "No account with that email" }`。alice のメールは `alice@example.com` |
| `POST /api/password/reset` | `{ token, password }` | `200 { username }`。不明なトークンや 8 文字未満は `400 { error }`。トークンは 1 回で無効になる |
| `GET /api/contacts` | | `200 Contact[]`（id 順。初回アクセスで 12 件がシードされる） |
| `POST /api/contacts` | `{ firstName, lastName, username, email, age }` | `201 Contact`。空欄や 0〜150 の整数でない age は `400 { error }` |
| `PATCH /api/contacts/:id` | 上の一部 | `200 Contact`、`400`、または `404` |
| `DELETE /api/contacts/:id` | | `204`、または `404` |
| `GET /api/contacts.csv` | | `200 text/csv`（`Content-Disposition: attachment; filename="contacts.csv"`）。ヘッダ行 `id,firstName,lastName,username,email,age` |
| `GET /api/board` | | `200 { cards: Card[] }`（todo → doing → done の列順、列の中は position 順。初回アクセスで 6 枚がシードされる） |
| `POST /api/board/cards` | `{ title, column? }` | `201 Card`（列の末尾）。title 空や未知の column は `400` |
| `PATCH /api/board/cards/:id` | `{ column?, position? }` | `200 { cards: Card[] }`（移動後の全体）、`400`、または `404` |
| `DELETE /api/board/cards/:id` | | `204`、または `404` |
| `GET /api/forms` | | `200 FormSubmission[]`（フォームごとの最新） |
| `POST /api/forms/:form` | `{ values }` | `201 FormSubmission`。form が inline / grid / basic / block / horizontal 以外は `404`、values が文字列と真偽値のオブジェクトでなければ `400` |
| `GET /api/files` | | `200 UploadedFile[]` |
| `POST /api/files` | multipart の `file` | `201 UploadedFile`（名前・サイズ・type だけ保存、中身は捨てる）。無ければ `400` |
| `DELETE /api/files/:id` | | `204`、または `404` |
| `GET /api/files/invoice.pdf` | | `200 application/pdf`（`Content-Disposition: attachment; filename="invoice.pdf"`。本文に `Invoice for <username>`、`Plan: <plan>`、`Open todos: <n>`）。未ログインなら `401` |
| `GET /api/metrics` | | `200 { contactsByAgeGroup: [{ group, count }], cardsByColumn: [{ column, name, count }] }`。group は `<20` / `20-29` / `30-39` / `40-49` / `50+` |
| `POST /api/reset` | | `204`。todo・登録ユーザー・トークン・フォーム送信・アップロードを消し、ログアウトし、Free プランに戻し、連絡先とカードをシードし直す（連絡先とカードの id は 1 から、todo の id は従来どおり続き番号）。**自分のセッションだけ。** |
| `GET /health` | | `200 { ok: true, version }` |

`Todo` は `{ id: number, title: string, done: boolean, createdAt: number }`、`Contact` は `{ id, firstName, lastName, username, email, age }`、`Card` は `{ id, title, column: "todo" | "doing" | "done", position }`、`FormSubmission` は `{ form, values, submittedAt }`、`UploadedFile` は `{ id, name, size, type, uploadedAt }` です（定義は `worker/types.ts`）。未知の `/api/*` パスは `404`、メソッド違いは `Allow` ヘッダー付きの `405` を返します。

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
npm run deploy          # → https://test-automation-practice-app.rymetry.workers.dev
```

### 自動デプロイ

本番デプロイは Cloudflare Workers Builds（Git 連携）で行います。`main` ブランチを連携し、ビルドコマンドに `npm run build`、デプロイコマンドに `npx wrangler deploy` を設定しておくことで、`main` への push 時に自動でビルドと本番デプロイが実行されます。GitHub Actions のデプロイ用ワークフローや、GitHub Secrets への `CLOUDFLARE_API_TOKEN` 設定は不要です。

### PR プレビュー

PR プレビューも Cloudflare Workers Builds（非本番ブランチのプレビュービルド。ビルドコマンド `npm run build`、プレビューコマンド `npx wrangler preview`）で行います。`main` 以外のブランチへ push すると隔離されたプレビュー環境がデプロイされ、対応する PR に Preview URL が自動で投稿されます。`wrangler.jsonc` の `previews` ブロックにより専用の `SessionDO` Durable Object namespace が自動作成されるため、本番 URL や本番データには影響しません。

> Preview URL はデフォルトで公開アクセス可能です。アクセス制限をかけたい場合は Cloudflare Access でプレビュー URL を保護してください。

> プレビュービルドは依存のインストールスクリプトとビルドを Cloudflare 側で実行し、その環境にはデプロイ用の API トークンがあります。Dependabot のブランチでは自動マージの検証より前に未検証の依存コードが動くため、Workers Builds の設定で `dependabot/*` ブランチを非本番ブランチのビルド対象から外してください（外せない場合は非本番ブランチのビルドを無効にします）。

## プロジェクト構成

```
index.html, src/        クライアント。history ベースの小さな SPA、ページごとに 1 モジュール、フレームワーク無し
src/layout.ts, nav.ts   サイドバー・トップバー・フッターのシェル、ナビゲーションの定義（Home のカード一覧もここから）
src/theme.ts            ライト / ダークの切替（初期値は OS 設定に従い、変更時は localStorage に保存）
src/ui/                 複数ページで使う部品: datepicker、toast、tooltip、ページ骨格
src/pages/              ページ。forms/、controls/、overlays/、tables/、auth/、practice/ にグループ分け
src/styles/             tokens（色・文字・余白・角丸・影・モーション・ページ幅）、base、layout、components
worker/index.ts         Worker。cookie と、worker/api/* へのディスパッチ。それ以外は静的アセットへフォールバック
worker/api/             ドメインごとの JSON API（todos、auth、billing、contacts、board、forms、files、metrics）
worker/session-do.ts    訪問者 1 人分の状態（todo・ユーザー・プラン・連絡先・カード・フォーム送信・ファイル名）を持つ Durable Object
worker/seed.ts, pdf.ts  シードデータと、依存無しの 1 ページ PDF 生成
wrangler.jsonc          Worker の設定。SPA 用のアセット配信、run_worker_first、Durable Object のバインディング
vite.config.ts          Vite と @cloudflare/vite-plugin（Worker が dev サーバーの中で動く）
AGENTS.md               開発・テスト契約保護・AI エージェント共通の運用ルール
docs/architecture/      構成の正本（overview.md）
```

予定: `mobile/` に同じ Todo アプリの Expo 版を追加し、デバイス上でのテスト練習に使う（デプロイ対象外）。

## Dependabot の更新

`main` を対象とする PR では、シークレットを使わない **PR CI** が型チェックとビルドを実行します。Dependabot PR のマージは既定で無効です。自動化を使うには、管理者が次を順に設定してください。

1. 普通の PR で `typecheck-build` が通ることを確認します。
2. `main` を対象とする **Active** な Ruleset で GitHub Actions の `typecheck-build` を必須チェックに指定し、「Require branches to be up to date before merging」をオンにします。GitHub Actions にこのルールをバイパスさせないでください。既存のレビュー要件は維持し、リポジトリでマージコミットを許可してください。
3. リポジトリ変数 `DEPENDABOT_AUTOMERGE` を `true` にします。停止する場合は削除するか、`false` にします。

対象は `@cloudflare/workers-types`、`@fontsource/ibm-plex-sans`、`vite`、`@cloudflare/vite-plugin`、`wrangler`、`typescript` の安定版マイナー・パッチ更新 1 件です。PR は同じリポジトリの Dependabot から開かれ、CI が通ったコミットが現在の `main` を唯一の親として持つ必要があります。

- **単一リーフパッケージ（`@cloudflare/workers-types` / `@fontsource/ibm-plex-sans`）:** ロックは対象パッケージ 1 件のバージョン・配布URL・整合性ハッシュだけを変更できます。
- **ビルドツール・コンパイラ（`vite` / `@cloudflare/vite-plugin` / `wrangler` / `typescript`）:** 対象パッケージから通常依存・オプション依存で辿れる依存グラフ内のロック変更（200 件まで）を許可し、全到達エッジの固定バージョン一致と、公開 npm の配布URL・SHA-512 整合性・インストールスクリプト有無・依存メタデータとの一致を照合します。インストールスクリプトは、更新前から依存グラフにある既知パッケージ（`workerd` / `esbuild` / `fsevents`）の継続更新に限り、新規追加は拒否します。

`.github/dependabot.yml` の `cooldown` により、公開から 3 日未満の直接依存の版では PR を作りません（推移的依存の公開日は照合しません）。peer 依存だけのリンクや他の直接依存への越境は許可せず、スクリプト・設定・複数パッケージの同時更新、メジャーや事前リリースへの直接更新は手動レビューです。GitHub Actions の更新は `GITHUB_TOKEN` に `workflows` 権限がないため手動レビューとし、`.github/dependabot.yml` で週次 1 本のグループ PR にまとめています。範囲や CI の紐づけを確認できない場合も自動マージせず、判定理由はワークフローのステップサマリーに出力します。既に `DEPENDABOT_AUTOMERGE=true` の場合、このポリシーは `main` にマージした後の対象 CI から適用されます。

Dependabot の PR が `main` にマージされると、`main` への push イベントを契機に Cloudflare Workers Builds が自動で本番ビルド・デプロイを実行します（追加の PAT やシークレットは不要です）。ビルドやデプロイが失敗した場合は、Cloudflare ダッシュボードから再実行してください。

## ライセンス

[MIT](LICENSE)
