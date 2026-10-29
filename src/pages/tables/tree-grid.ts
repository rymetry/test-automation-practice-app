import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

interface Node {
  name: string;
  kind: string;
  /** Bytes. Folders have none; their size is the sum of their children. */
  size?: number;
  children?: Node[];
}

const KB = 1024;
const FILES: Node[] = [
  {
    name: 'Projects',
    kind: 'dir',
    children: [
      { name: 'project-1.doc', kind: 'doc', size: 240 * KB },
      { name: 'project-2.doc', kind: 'doc', size: 290 * KB },
      {
        name: 'project-3',
        kind: 'dir',
        children: [
          { name: 'project-3A.txt', kind: 'txt', size: 466 * KB },
          { name: 'project-3B.txt', kind: 'txt', size: 102 * KB },
        ],
      },
    ],
  },
  {
    name: 'Reports',
    kind: 'dir',
    children: [
      { name: 'Report 1', kind: 'doc', size: 100 * KB },
      { name: 'Report 2', kind: 'doc', size: 300 * KB },
    ],
  },
  {
    name: 'Other',
    kind: 'dir',
    children: [
      { name: 'Spring Budget.xlsx', kind: 'xlsx', size: 12 * KB },
      { name: 'backup.zip', kind: 'zip', size: 1.2 * KB * KB },
    ],
  },
];

function sizeOf(node: Node): number {
  return node.size ?? (node.children ?? []).reduce((sum, child) => sum + sizeOf(child), 0);
}

export function formatSize(bytes: number): string {
  if (bytes >= KB * KB) return `${(bytes / KB / KB).toFixed(1)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}

let ids = 0;

/** A file tree with Size and Kind columns. `tree` / `treeitem` roles; parents carry aria-expanded. */
export const treeGridPage: Page = (root) => {
  const view = page(
    'Tree grid',
    'フォルダとファイルの階層です。e2e のロール一覧に treegrid が無いので tree と treeitem で作っています。親の treeitem は aria-expanded を持ち、クリックか矢印キーで開閉します。絞り込むと、一致した項目の親が自動で開きます。',
    `
      <div class="field" style="max-width: 20rem; margin-bottom: var(--space-3)">
        <label for="tree-filter">Filter</label>
        <input id="tree-filter" type="text" autocomplete="off" data-testid="tree-filter" />
      </div>
      <div role="tree" aria-label="Files" class="tree" data-testid="file-tree">
        <div class="tree-header" aria-hidden="true"><span>Name</span><span>Size</span><span>Kind</span></div>
        <div data-slot="items"></div>
      </div>
    `,
  );
  root.append(view);

  const slot = q(view, '[data-slot="items"]');
  const filter = q<HTMLInputElement>(view, '#tree-filter');

  function render(nodes: Node[], level: number, query: string): HTMLElement[] {
    const items: HTMLElement[] = [];
    for (const node of nodes) {
      const selfMatch = node.name.toLowerCase().includes(query);
      // A folder that matches keeps all of its children; otherwise only the matching branches survive.
      const children = node.children ? render(node.children, level + 1, selfMatch ? '' : query) : [];
      if (query && !selfMatch && children.length === 0) continue;

      const id = `tree-node-${++ids}`;
      const isParent = node.children !== undefined;
      const item = html(`
        <div role="treeitem" aria-level="${level}" aria-labelledby="${id}" tabindex="-1" data-testid="tree-item" ${isParent ? 'aria-expanded="false"' : ''}>
          <div class="tree-row">
            <span class="tree-name">
              <span class="tree-caret" aria-hidden="true">${isParent ? '▶' : ''}</span>
              <span id="${id}">${esc(node.name)}</span>
            </span>
            <span>${formatSize(sizeOf(node))}</span>
            <span>${esc(node.kind)}</span>
          </div>
        </div>
      `);
      if (isParent) {
        const group = html('<div role="group"></div>');
        group.append(...children);
        group.hidden = true;
        item.append(group);
        // A filter match below this folder opens it so the match is visible.
        if (query && children.length > 0) setExpanded(item, true);
      }
      items.push(item);
    }
    return items;
  }

  function setExpanded(item: HTMLElement, expanded: boolean): void {
    if (!item.hasAttribute('aria-expanded')) return;
    item.setAttribute('aria-expanded', String(expanded));
    const group = item.querySelector<HTMLElement>(':scope > [role="group"]');
    if (group) group.hidden = !expanded;
  }

  function visibleItems(): HTMLElement[] {
    return [...slot.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((item) => item.offsetParent !== null);
  }

  function draw(): void {
    slot.innerHTML = '';
    slot.append(...render(FILES, 1, filter.value.trim().toLowerCase()));
    const first = slot.querySelector<HTMLElement>('[role="treeitem"]');
    if (first) first.tabIndex = 0;
  }

  slot.addEventListener('click', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.tree-row');
    const item = row?.parentElement;
    if (!item) return;
    focusItem(item);
    setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
  });

  function focusItem(item: HTMLElement): void {
    for (const other of slot.querySelectorAll<HTMLElement>('[role="treeitem"]')) other.tabIndex = -1;
    item.tabIndex = 0;
    item.focus();
  }

  slot.addEventListener('keydown', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    if (!item) return;
    const items = visibleItems();
    const index = items.indexOf(item);
    if (event.key === 'ArrowRight') setExpanded(item, true);
    else if (event.key === 'ArrowLeft') setExpanded(item, false);
    else if (event.key === 'Enter' || event.key === ' ') setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
    else if (event.key === 'ArrowDown' && items[index + 1]) focusItem(items[index + 1]!);
    else if (event.key === 'ArrowUp' && items[index - 1]) focusItem(items[index - 1]!);
    else return;
    event.preventDefault();
  });

  filter.addEventListener('input', draw);
  draw();
};
