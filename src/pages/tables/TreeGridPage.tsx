import { useId, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { formatSize } from '../../ui/format';
import { PageLayout } from '../../ui/PageLayout';

interface FileNode {
  name: string;
  kind: string;
  /** バイト数。フォルダは持たず、配下の合計を算出する。 */
  size?: number;
  children?: FileNode[];
}

interface FilteredNode {
  node: FileNode;
  path: string;
  level: number;
  isParent: boolean;
  children: FilteredNode[];
  autoExpand: boolean;
}

const KB = 1024;
const FILES: FileNode[] = [
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

function sizeOf(node: FileNode): number {
  return node.size ?? (node.children ?? []).reduce((sum, child) => sum + sizeOf(child), 0);
}

function filterNodes(nodes: FileNode[], level: number, query: string, parentPath = ''): FilteredNode[] {
  const items: FilteredNode[] = [];
  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    const selfMatch = node.name.toLowerCase().includes(query);
    // フォルダ名が一致した場合は配下をすべて残し、そうでなければ一致ブランチのみ残す。
    const children = node.children ? filterNodes(node.children, level + 1, selfMatch ? '' : query, path) : [];
    if (query && !selfMatch && children.length === 0) continue;
    const isParent = node.children !== undefined;
    items.push({
      node,
      path,
      level,
      isParent,
      children,
      autoExpand: Boolean(isParent && query && children.length > 0),
    });
  }
  return items;
}

function collectAutoExpanded(items: FilteredNode[], target: Record<string, boolean> = {}): Record<string, boolean> {
  for (const item of items) {
    if (item.autoExpand) target[item.path] = true;
    if (item.children.length > 0) collectAutoExpanded(item.children, target);
  }
  return target;
}

function collectVisiblePaths(items: FilteredNode[], expanded: Record<string, boolean>): string[] {
  const result: string[] = [];
  for (const item of items) {
    result.push(item.path);
    if (item.isParent && expanded[item.path]) {
      result.push(...collectVisiblePaths(item.children, expanded));
    }
  }
  return result;
}

/** Size・Kind 列付きのファイルツリー。tree / treeitem ロールを使い、親項目は aria-expanded を持つ。 */
export function TreeGridPage(): JSX.Element {
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focusedPath, setFocusedPath] = useState<string | null>(() => FILES[0]?.name ?? null);

  const treeIdPrefix = useId();
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const query = filterText.trim().toLowerCase();
  const tree = filterNodes(FILES, 1, query);
  const visiblePaths = collectVisiblePaths(tree, expanded);

  const handleFilterChange = (nextFilter: string): void => {
    const nextQuery = nextFilter.trim().toLowerCase();
    const nextTree = filterNodes(FILES, 1, nextQuery);
    setFilterText(nextFilter);
    setExpanded(nextQuery ? collectAutoExpanded(nextTree) : {});
    setFocusedPath(nextTree[0]?.path ?? null);
  };

  const focusByPath = (path: string): void => {
    setFocusedPath(path);
    itemRefs.current.get(path)?.focus();
  };

  const handleKeyDown = (item: FilteredNode, event: KeyboardEvent<HTMLDivElement>): void => {
    // 入れ子の子 treeitem で起きたキー操作が親フォルダへバブリングしないように止める。
    event.stopPropagation();
    const index = visiblePaths.indexOf(item.path);
    if (event.key === 'ArrowRight') {
      if (item.isParent) setExpanded((prev) => ({ ...prev, [item.path]: true }));
    } else if (event.key === 'ArrowLeft') {
      if (item.isParent) setExpanded((prev) => ({ ...prev, [item.path]: false }));
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (item.isParent) setExpanded((prev) => ({ ...prev, [item.path]: !prev[item.path] }));
    } else if (event.key === 'ArrowDown') {
      const nextPath = visiblePaths[index + 1];
      if (!nextPath) return;
      focusByPath(nextPath);
    } else if (event.key === 'ArrowUp') {
      const prevPath = visiblePaths[index - 1];
      if (!prevPath) return;
      focusByPath(prevPath);
    } else {
      return;
    }
    event.preventDefault();
  };

  const renderTree = (items: FilteredNode[]): JSX.Element[] =>
    items.map((item) => {
      const labelId = `${treeIdPrefix}-${item.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      const isExpanded = Boolean(expanded[item.path]);
      return (
        <div
          key={item.path}
          ref={(el) => {
            if (el) itemRefs.current.set(item.path, el);
            else itemRefs.current.delete(item.path);
          }}
          role="treeitem"
          aria-level={item.level}
          aria-labelledby={labelId}
          aria-expanded={item.isParent ? isExpanded : undefined}
          tabIndex={focusedPath === item.path ? 0 : -1}
          data-testid="tree-item"
          onKeyDown={(event) => handleKeyDown(item, event)}
        >
          <div
            className="tree-row"
            onClick={(event) => {
              event.stopPropagation();
              focusByPath(item.path);
              if (item.isParent) {
                setExpanded((prev) => ({ ...prev, [item.path]: !prev[item.path] }));
              }
            }}
          >
            <span className="tree-name">
              <span className="tree-caret" aria-hidden="true">
                {item.isParent ? '▶' : ''}
              </span>
              <span id={labelId}>{item.node.name}</span>
            </span>
            <span>{formatSize(sizeOf(item.node))}</span>
            <span>{item.node.kind}</span>
          </div>
          {item.isParent ? (
            <div role="group" hidden={!isExpanded}>
              {renderTree(item.children)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <PageLayout
      title="Tree grid"
      intro="フォルダとファイルの階層です。e2e のロール一覧に treegrid が無いので tree と treeitem で作っています。親の treeitem は aria-expanded を持ち、クリックか矢印キーで開閉します。絞り込むと、一致した項目の親が自動で開きます。"
      size="medium"
    >
      <div className="field" style={{ maxWidth: '22rem', marginBottom: 'var(--space-4)' }}>
        <label htmlFor="tree-filter">Filter</label>
        <input
          id="tree-filter"
          type="text"
          autoComplete="off"
          data-testid="tree-filter"
          value={filterText}
          onChange={(event) => handleFilterChange(event.target.value)}
        />
      </div>
      <div role="tree" aria-label="Files" className="tree" data-testid="file-tree">
        <div className="tree-header" aria-hidden="true">
          <span>Name</span>
          <span>Size</span>
          <span>Kind</span>
        </div>
        <div data-slot="items">{renderTree(tree)}</div>
      </div>
    </PageLayout>
  );
}

