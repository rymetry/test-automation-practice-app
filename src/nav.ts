export interface NavLink {
  /** Link text. Also the accessible name, so it is unique across the app. */
  label: string;
  href: string;
  /** One line in Japanese, shown on the Home cards. */
  description: string;
}

/** The original navigation. Order and labels are fixed: the course tests depend on them. */
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
    label: 'Overlays',
    links: [
      { label: 'Dialog', href: '/overlays/dialog', description: 'モーダルを開いて閉じる' },
      { label: 'Window', href: '/overlays/window', description: '同時に複数開ける小さな窓' },
      { label: 'Popover', href: '/overlays/popover', description: 'クリックとホバーで出る吹き出し' },
      { label: 'Toastr', href: '/overlays/toastr', description: '時間で消える通知' },
      { label: 'Tooltip', href: '/overlays/tooltip', description: 'ホバーとフォーカスで出る説明' },
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
    links: [{ label: 'Unnamed elements', href: '/unnamed', description: 'わざと名前の無い部品だけのページ' }],
  },
];

export const ALL_LINKS: NavLink[] = [...MAIN_LINKS, ...COMPONENT_GROUPS.flatMap((group) => group.links)];
