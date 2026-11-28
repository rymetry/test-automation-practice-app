// scripts/ui-contract.test.mjs から Node.js で直接 import するため、
// 他モジュールへの値 import・JSX・非 erasable 構文を持たない純粋データモジュールとして維持する。
export interface NavLink {
  /** リンクの文言。アクセシブル名も兼ねるので、アプリ全体で一意にする。 */
  label: string;
  href: string;
  /** Home のカードに表示する日本語の 1 行説明。 */
  description: string;
}

/** 元からあるナビゲーション。講座のテストが依存しているので、順序とラベルは固定。 */
export const MAIN_LINKS: NavLink[] = [
  { label: 'Home', href: '/', description: '入口ページ' },
  { label: 'Todos', href: '/todos', description: 'todo の追加、完了、削除、絞り込み' },
  { label: 'Billing', href: '/settings/billing', description: 'サインインが必要なプラン変更' },
  { label: 'Slow page', href: '/slow', description: '2 秒後に表示される内容を待つ' },
  { label: 'Ambiguous page', href: '/ambiguous', description: '同じ名前のボタンが 2 つある' },
];

export const COMPONENT_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: 'Forms',
    links: [
      { label: 'Form layouts', href: '/forms/layouts', description: '5 種類のレイアウトのフォームと検証' },
      { label: 'Datepicker', href: '/forms/datepicker', description: '単一、範囲、上下限つきの日付選択' },
    ],
  },
  {
    label: 'Controls',
    links: [
      { label: 'Tabs & Accordion', href: '/controls/tabs', description: 'タブ切替と複数開閉できるアコーディオン' },
      { label: 'Combobox & Controls', href: '/controls/inputs', description: '候補絞り込み、スイッチ、スライダーの設定フォーム' },
    ],
  },
  {
    label: 'Overlays',
    links: [
      { label: 'Dialog', href: '/overlays/dialog', description: 'モーダルを開いて閉じる' },
      { label: 'Window', href: '/overlays/window', description: '同時に複数開ける小さな窓' },
      { label: 'Popover', href: '/overlays/popover', description: 'クリックとホバーで出る吹き出し' },
      { label: 'Toastr', href: '/overlays/toastr', description: '時間で消える通知' },
      { label: 'Tooltip', href: '/overlays/tooltip', description: 'ホバーとフォーカスで出る説明' },
      { label: 'Browser alerts', href: '/overlays/browser', description: 'alert・confirm・prompt と別タブ遷移' },
    ],
  },
  {
    label: 'Data',
    links: [
      { label: 'Smart table', href: '/tables/smart-table', description: '追加、編集、削除、並べ替え、絞り込み、ページ送り' },
      { label: 'Tree grid', href: '/tables/tree-grid', description: '開閉できる階層構造' },
      { label: 'Board', href: '/board', description: 'ドラッグ＆ドロップで列を移動' },
      { label: 'Charts', href: '/charts', description: 'SVG のグラフと同じ値の表' },
    ],
  },
  {
    label: 'Auth',
    links: [
      { label: 'Register', href: '/auth/register', description: 'このセッションだけのアカウント登録' },
      { label: 'Request password', href: '/auth/request-password', description: 'リセット用トークンの発行' },
      { label: 'Reset password', href: '/auth/reset-password', description: 'トークンでパスワードを変更' },
    ],
  },
  {
    label: 'Files',
    links: [{ label: 'Files', href: '/files', description: 'PDF と CSV のダウンロード、アップロード' }],
  },
  {
    label: 'Practice',
    links: [
      { label: 'Iframe & Shadow DOM', href: '/practice/frames', description: '埋め込みフレームと Shadow DOM 内の入力' },
      { label: 'Dynamic states', href: '/practice/dynamic', description: '遅延有効化、進捗バー、スクロール追加読み込み' },
      { label: 'Unnamed elements', href: '/unnamed', description: 'わざと名前の無い部品だけのページ' },
    ],
  },
];

export const ALL_LINKS: NavLink[] = [...MAIN_LINKS, ...COMPONENT_GROUPS.flatMap((group) => group.links)];
