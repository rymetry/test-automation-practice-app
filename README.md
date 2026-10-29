# test-automation-practice-app

A small, deliberately simple Todo app built as a **stable target for practising test automation**: UI tests, API tests, and agentic end-to-end tests with any framework (Playwright, Cypress, [e2e by TesterArmy](https://e2e.tester.army/docs), Maestro, …).

- Every visitor gets an **isolated session**: your todos, sign-in state and plan never collide with anyone else's, and a `POST /api/reset` only resets *your* session.
- Markup is **semantic first** (`getByRole` / `getByLabel` work everywhere) and every important element also carries a `data-testid`.
- A few pages exist only to practise specific testing problems: a slow page, a page with two buttons that share a name.
- No e2e tests live in this repository. Tutorials and courses that use the app keep their tests on their own side.

## Run it

Requires Node.js 24 or newer.

```bash
npm install
npm run dev        # http://localhost:3000 (Vite + the Cloudflare Worker, both local)
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Builds the client and the Worker into `dist/` |
| `npm run preview` | Serves the production build locally on port 3000 |
| `npm run typecheck` | Type-checks `src/` (browser) and `worker/` (Workers runtime) |
| `npm run deploy` | Builds and deploys to Cloudflare Workers (needs `npx wrangler login` once) |

## Pages (what a test sees)

All pages share a header with a `navigation` named **Main** containing the links **Home**, **Todos**, **Billing**, **Slow page**, **Ambiguous page**, plus either a link **Sign in** or the text "Signed in as alice" with a **Sign out** button (`data-testid="sign-out"`). The document title is `<Page> · Todo App`.

| Route | Elements (role "name") | `data-testid` | Behaviour |
| --- | --- | --- | --- |
| `/` | `heading` "Todo App" | | Entry page. |
| `/todos` | `textbox` "New todo", `button` "Add", `group` "Filter" with `radio` "All" / "Active" / "Completed", `list` "Todos" of `listitem`s, each with a `checkbox` named after the todo and a `button` "Delete", `status` "N remaining" | `new-todo-form`, `new-todo-input`, `add-todo`, `filters`, `todo-list`, `todo-item`, `delete-todo`, `remaining` | Submitting an empty title does nothing. Checking a todo lowers "N remaining". No sign-in needed. |
| `/login` | `textbox` "Username", `textbox` "Password" (type password), `button` "Sign in"; on failure an `alert` "Invalid username or password" | `login-form`, `username`, `password`, `sign-in`, `login-error` | Success goes to `/todos` and the header shows "Signed in as alice". |
| `/settings/billing` | `status` "Current plan: Free" (or "Pro"), `button` "Upgrade to Pro", a `dialog` titled "Upgrade to Pro?" with `button` "Confirm" and `button` "Cancel" | `plan`, `plan-name`, `upgrade`, `upgrade-dialog`, `confirm-upgrade`, `cancel-upgrade` | Redirects to `/login` when not signed in. Confirm switches the status to "Pro" and hides the upgrade button. |
| `/slow` | `status` "Loading…" for 2 seconds, then `heading` "Loaded" | `loading`, `loaded` | For practising explicit waits instead of sleeps. |
| `/ambiguous` | Two `region`s, "Drafts" and "Published", each with a `button` "Delete"; a `status` reports which one was clicked | `drafts`, `published`, `delete-draft`, `delete-published`, `ambiguous-result` | For practising locators that match more than one element. |
| anything else | `heading` "Page not found" | | Client-side 404. |

The only account is **alice / password123**. It is public on purpose; the app holds nothing private.

## API

Every request is scoped to a session (see below). Responses are JSON; `Cache-Control: no-store`.

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/session` | | `201 { sid }`, sets the `sid` cookie. Always starts a **new** session. |
| `GET /api/todos` | | `200 Todo[]` |
| `POST /api/todos` | `{ title }` | `201 Todo`, or `400 { error }` when the title is empty |
| `PATCH /api/todos/:id` | `{ done?: boolean, title?: string }` | `200 Todo`, `400`, or `404` |
| `DELETE /api/todos/:id` | | `204`, or `404` |
| `POST /api/login` | `{ username, password }` | `200 { username }`, or `401 { error: "Invalid username or password" }` |
| `POST /api/logout` | | `204` |
| `GET /api/me` | | `200 { username: "alice" }` or `200 { username: null }` |
| `GET /api/billing` | | `200 { plan: "Free" \| "Pro" }`, or `401` when not signed in |
| `POST /api/billing/upgrade` | | `200 { plan: "Pro" }`, or `401` |
| `POST /api/reset` | | `204`. Clears the todos, signs out, back to the Free plan. **This session only.** |
| `GET /health` | | `200 { ok: true, version }` |

`Todo` is `{ id: number, title: string, done: boolean, createdAt: number }`. Unknown `/api/*` paths answer `404`, wrong methods `405` with an `Allow` header.

### Sessions

- The first `/api/*` request without a session gets a `Set-Cookie: sid=<uuid>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`.
- A request can also name its session with the header `X-Session-Id: <sid>`. This is how an API test shares the session of a browser (`browser.cookies()` → header), or keeps its own.
- A session that receives no request for **24 hours** deletes itself.
- Each session is one Durable Object with SQLite storage; nothing is shared between sessions.

```bash
# Two independent sessions from the shell
curl -s -c a.txt -X POST http://localhost:3000/api/session
curl -s -b a.txt -X POST http://localhost:3000/api/todos -H 'Content-Type: application/json' -d '{"title":"Write the release notes"}'
curl -s -b a.txt http://localhost:3000/api/todos         # one todo
curl -s -c b.txt http://localhost:3000/api/todos         # [] — a different session
```

## Using it from a test suite

- Point the suite at `http://localhost:3000` (run `npm run dev` here) or at the deployed URL. A test runner that can start the app itself can run `npm run dev` from this directory.
- Start each test from a clean state with `POST /api/reset`, or open a brand-new session with `POST /api/session`.
- A fresh browser context gets a fresh session automatically; nothing to clean up afterwards.
- Prefer `getByRole` / `getByLabel`; fall back to the `data-testid` values in the tables above.

## Deploy

The app is one Cloudflare Worker: static assets plus `/api/*` and `/health` handled by the Worker, state in Durable Objects (SQLite-backed, available on the Workers Free plan).

```bash
npx wrangler login      # once
npm run deploy          # → https://test-automation-practice-app.<account>.workers.dev
```

## Project layout

```
index.html, src/        the client: a tiny history-based SPA, one module per page, no framework
worker/index.ts         the Worker: cookies, routing, JSON API, falls back to the static assets
worker/session-do.ts    the Durable Object holding one visitor's todos, user and plan
wrangler.jsonc          Worker config: SPA asset handling, run_worker_first, Durable Object binding
vite.config.ts          Vite with @cloudflare/vite-plugin (the Worker runs inside the dev server)
```

Planned: `mobile/`, an Expo version of the same Todo app for practising on-device testing (not deployed).

---

## 日本語の概要

テスト自動化（UI / API / エージェント型 E2E）の練習台として作った小さな Todo アプリです。訪問者ごとにセッションが分離されるので、公開 URL を複数人で同時に叩いてもデータが混ざらず、`POST /api/reset` も自分のセッションだけを初期化します。マークアップはセマンティック優先（`getByRole` / `getByLabel` が効く）で、主要要素には `data-testid` も付けています。`/slow`（2 秒後に描画）と `/ambiguous`（同名ボタンが 2 つ）は、待機と曖昧なロケータを練習するための専用ページです。ログインできるアカウントは `alice / password123` のみです。
