# 生き残りやすい変異の型

変異テストで繰り返し生き残った変異を、型ごとにまとめる。上にあるものほど頻繁に見つかった。コード例は TypeScript 風の擬似コード。

## 1. ガードの削除・条件の反転

- **見逃す理由**:正常系しか通していない。または拒否を「何かが投げられる」とだけ見ていて、ガードを消しても後段の別のエラーで通る。
- **書き方**:ガード 1 つにつき 1 ケース。そのガード固有のエラーを照合し、副作用が起きていないことも見る。ガードを消したら別の理由で落ちる入力にする。

```ts
await expect(run({ approved: false })).rejects.toThrow('approval required')
expect(sentRequests).toHaveLength(0)
```

## 2. 常に拒否する変異(ガードの片側だけを試している)

- **見逃す理由**:拒否だけを試しているので、条件を常に真にしても通る。
- **書き方**:拒否の隣に、ぎりぎり通るケースを置く。通った結果の中身まで見る。

```ts
expect(() => parse(['--resume'], emptyDir)).toThrow('no saved state')
expect(parse(['--resume'], dirWithState).resumeFrom).toBe(savedStep)
```

## 3. 境界の比較演算子と閾値(`>=` と `>`、定数の ±1)

- **見逃す理由**:入力が閾値から遠い値だけ。
- **書き方**:ちょうどの値と 1 つ隣の値を両方試す。率の境界は、分子と分母を逆算してちょうどその率になる入力を作る。ほかの閾値には触れない値にする。

```ts
expect(check({ durationMs: 2000 }).status).toBe('pass')
expect(check({ durationMs: 2001 }).status).toBe('fail')
```

## 4. 集計の項・フィルタ条件の脱落

- **見逃す理由**:落とされる項がフィクスチャで 0 だった。フィルタで除かれる要素が 1 つもなかった。`> 0` や近似でしか比較していない。
- **書き方**:各項に、互いに区別できる 0 でない値を入れる。フィルタは、含まれる要素と除かれる要素の両方を入れ、件数を厳密に照合する。

```ts
setDuration('queue', 1000); setDuration('process', 300)
expect(report.totalMs).toBe(1300) // どちらを落としても、引き算にしても別の値になる
```

## 5. 「出さない」条件の脱落(`&&` の 1 句を消す)

- **見逃す理由**:出る状態で「ある」ことしか見ていない。存在確認なので、2 個出ても通る。
- **書き方**:出さない状態ごとに否定の検証を書く。存在ではなく個数を見る。一覧は位置ごとの配列で照合する。

```ts
expect(headings()).toHaveLength(1)
expect(options().map(isSelected)).toEqual([false, true, false])
```

## 6. 文字列・対応表・理由の変異

- **見逃す理由**:代表値を 1〜2 個しか試していない。成否だけを見て理由を見ていない。
- **書き方**:列挙の全値を表で回す。成功時に理由が空であることも固定する。

```ts
test.each([['quota', 'pause'], ['error', 'notice']])('%s', (kind, tone) =>
  expect(toneOf(kind)).toBe(tone))
expect(result.reasons).toEqual([])
```

## 7. 入力の正規化の脱落(trim、大文字小文字、正規表現のアンカー)

- **見逃す理由**:フィクスチャが常に正規化済みのきれいな値。
- **書き方**:正しい値に加え、正規化前の形を 1 つずつ渡す。前後の空白、末尾の改行、大文字、`'0'`、数値でない文字列、区切り文字入り、長さの上限 +1。

```ts
expect(readValue(`  ${path}  `)).toBe('value') // ファイルの中身は '  value\n'
for (const invalid of ['bad id', 'a/b', 'x'.repeat(maxLength + 1)])
  expect(parse(invalid).id).toBeUndefined()
```

## 8. ロック・一時資源・グローバル状態の取得と解放

- **見逃す理由**:包まれた処理の戻り値だけを見ている。取得を丸ごと飛ばしても戻り値は変わらない。
- **書き方**:処理の途中で資源の状態を見る。終了後は、個別のファイルの有無ではなくディレクトリ一覧の完全一致で見る。解放してはいけない場合(所有者が変わった)も 1 件書く。

```ts
await withLock(dir, async () => {
  expect(readFile(lockPath)).toBe(String(process.pid))
})
expect(readdir(dir)).toEqual([])
```

## 9. 複数の経路に複製された検査の 1 本だけを消す

- **見逃す理由**:1 つの経路でしか試していない。
- **書き方**:経路ごとに同じシナリオを回し、止まった理由・件数・どの経路かを厳密に照合する。隣の検査には引っかからない入力にする。

```ts
const result = await run({ only: 'export', usage: overLimitUsage })
expect(result.stopReason).toBe('limit_exceeded')
expect(result.failed.map((unit) => unit.path)).toEqual(['export'])
```

## 10. エラー種別の判定(握りつぶし、すべて同じ扱い)

- **見逃す理由**:想定した 1 種類のエラーしか起こしていない。
- **書き方**:処理する種別と、呼び出し元へ伝える種別を 1 つずつ注入する。伝える側はエラーコードまで照合する。

```ts
io.read = () => { throw errorWithCode('EACCES') }
await expect(load(path)).rejects.toMatchObject({ code: 'EACCES' })
io.read = () => { throw errorWithCode('ENOENT') } // こちらは既定値で続行する
await expect(load(path)).resolves.toEqual(defaults)
```

## 11. 締切・中断・経過時間・再試行回数

- **見逃す理由**:偽の通信が常に即座に返るので、締切が一度も発火しない。経過時間の値を見ていない。
- **書き方**:中断されるまで返らない偽物に短い締切を渡す。失敗の分類と、経過時間の下限・上限を見る。再試行は時計を差し替えて回数を固定する。

```ts
const neverResolves = (_url, init) => new Promise((_, reject) =>
  init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
const result = await fetchWithDeadline(request, { timeoutMs: 30, fetch: neverResolves })
expect(result).toMatchObject({ ok: false, failure: 'timeout' })
```

## 12. 値の取り違え(別の変数・既定値・別経路の値を渡す)

- **見逃す理由**:フィクスチャで 2 つの値がたまたま同じ。
- **書き方**:取り違えうる 2 つの値が、違う結果を生む入力を選ぶ。

```ts
setScore(item, 0.72) // 閾値 0.7 では該当、0.8 では該当しない
expect(countAbove(0.7) - countAbove(0.8)).toBe(1)
```

## 13. 複合条件の 1 句(`a || b || c` の 1 つを消す、`||` と `&&` の入れ替え)

- **見逃す理由**:不正な入力が複数の句に同時に違反している。
- **書き方**:1 句だけに違反する入力を、句の数だけ表にする。

```ts
for (const invalid of [{ count: -1 }, { count: 1.5 }, { size: 0 }])
  await expect(save({ ...valid, ...invalid })).rejects.toMatchObject({ code: 'invalid_input' })
```

## 14. 順序(並べ替えの削除・逆順)

- **見逃す理由**:要素が 1〜2 個で順序が観測できない。集合として比較している。
- **書き方**:3 要素以上を、並びを崩して入力し、配列の完全一致で見る。

```ts
expect(sortByCreatedAt([third, first, second])).toEqual([first, second, third])
```

## 15. 偽物・検査が引数や種類を見ていない

- **見逃す理由**:偽物が引数を無視している。「この 2 種類の違反がないこと」と絞っているので、別の種類が出ても通る。
- **書き方**:偽物が受け取った引数を完全一致で照合する。違反は、既知の例外だけを除いて残りが空であることを見る。

```ts
expect(fakeFetch.calls[0].headers).toEqual({ authorization: 'Bearer token', 'content-type': 'application/json' })
expect(violations.filter((violation) => !isKnownException(violation))).toEqual([])
```

## 16. 上流の検査に隠れた下流の検査

- **見逃す理由**:上流が同じ異常を先に止めるので、下流の検査を消しても結果が変わらず、等価に見える。
- **書き方**:上流の信号だけを落とした状態で、下流だけで止まることを見る。

```ts
upstream.report = (event) => original.report({ ...event, stop: undefined })
expect((await run(overLimitInput)).stopReason).toBe('limit_exceeded')
```

## ツールが自動では作らない変異

SQL などの文字列の中の条件や、保存する列の脱落は、変異テストのツールが対象にしないことが多い。

- 実物のデータストアに対して、上限ちょうどで次の 1 件が拒否されることを、保存された行数で見る。更新後の行は丸ごと照合する。
- 変異は手で 1 件ずつ当てて対象のテストを実行し、次の変異の前に元へ戻す。未コミットの変更を失わないよう、コミット済みの隔離した作業ツリーで行う。

## テストの組み立てが原因で検出できない場合

- **子プロセス**:CLI を子プロセスで起動するテストでは、変異したコードに届いたかをツールが判定できない。引数の解析や本体の処理を、同じプロセスから呼べる形でテストする。
- **ガードが消えたときの暴走**:送信や削除を伴う処理は、ガードが消えても実際には実行されないようにする(通信を偽物にする、存在しないパスを渡す)。テストが作っていないプロセスやファイルを、対象のコードが返した値をもとに操作しない。
- **計測下のタイムアウト**:計測でテストが遅くなり、変異なしでも制限時間を超えることがある。重いテストには個別に上限を付け、他の重い処理と同時に動かさない。
- **対象が 0 件**:テストだけを変えた差分は、既定では変異が 0 件になる。スコアが 100% でも、試した変異の件数を確認する。
