import { useRef, useState, type JSX, type KeyboardEvent } from 'react';
import type { Page } from '../../router';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';

interface TabItem {
  id: string;
  label: string;
  body: string;
}

interface AccordionItem {
  id: string;
  heading: string;
  body: string;
  initialOpen: boolean;
}

const TABS: TabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    body: 'タブはクリックのほか、左右矢印キー・Home・End キーで自動的に選択とフォーカスが切り替わります。',
  },
  {
    id: 'specs',
    label: 'Specs',
    body: '各タブボタンは aria-selected と aria-controls を持ち、選択中のタブだけが tabindex="0" になります。非表示パネルには hidden 属性が付きます。',
  },
  {
    id: 'changelog',
    label: 'Changelog',
    body: 'この画面の状態はクライアント内だけで保持されます。ページを再読み込みすると最初のタブと先頭のアコーディオンが開いた状態に戻ります。',
  },
];

const ACCORDION_ITEMS: AccordionItem[] = [
  {
    id: '1',
    heading: 'What is session isolation?',
    body: '訪問者ごとにセッション Cookie が発行され、Todo やフォーム送信などのサーバー保存データは別セッションと分離されます。',
    initialOpen: true,
  },
  {
    id: '2',
    heading: 'How do I reset state?',
    body: 'このページのようなクライアント完結の部品はリロードで初期化されます。サーバー保存データを初期化したい場合は Cookie を削除します。',
    initialOpen: false,
  },
  {
    id: '3',
    heading: 'Which locators should I use?',
    body: 'まずは getByRole とアクセシブル名を使い、同じロールが複数ある箇所は region や見出し、または data-testid で絞り込んでください。',
    initialOpen: false,
  },
];

/** タブとアコーディオンの操作練習ページ。状態は画面内のみで保持する。 */
export function TabsPage(): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ACCORDION_ITEMS.map((item) => [item.id, item.initialOpen])),
  );
  const [result, setResult] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activateTab = (index: number, focusTab: boolean): void => {
    const target = TABS[index];
    if (!target) return;
    setActiveIndex(index);
    if (focusTab) tabRefs.current[index]?.focus();
    setResult(`Selected tab: ${target.label}`);
  };

  const handleTabKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex, true);
  };

  const toggleAccordion = (item: AccordionItem): void => {
    const nextExpanded = !expanded[item.id];
    setExpanded((prev) => ({ ...prev, [item.id]: nextExpanded }));
    setResult(`${nextExpanded ? 'Expanded' : 'Collapsed'}: ${item.heading}`);
  };

  return (
    <PageLayout
      title="Tabs & Accordion"
      intro="タブとアコーディオンの操作練習です。タブはクリックと左右矢印キー・Home・End キーで切り替わります。アコーディオンは複数項目を同時に開いた状態にできます。変更はこの画面内だけで保持され、リロードすると初期状態に戻ります。"
      size="medium"
    >
      <div className="card">
        <h2>Tabs</h2>
        <div className="tabs">
          <div role="tablist" aria-label="Sections" className="tablist" data-testid="tabs-list">
            {TABS.map((tab, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  id={`tab-${tab.id}`}
                  role="tab"
                  className="tab"
                  aria-selected={selected}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  data-testid={`tab-${tab.id}`}
                  onClick={() => activateTab(index, false)}
                  onKeyDown={(event) => handleTabKeyDown(index, event)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {TABS.map((tab, index) => (
            <div
              key={tab.id}
              id={`tabpanel-${tab.id}`}
              role="tabpanel"
              className="tabpanel"
              tabIndex={0}
              aria-labelledby={`tab-${tab.id}`}
              data-testid={`tabpanel-${tab.id}`}
              hidden={index !== activeIndex}
            >
              <p>{tab.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Accordion</h2>
        <div className="accordion" data-testid="accordion">
          {ACCORDION_ITEMS.map((item) => {
            const isExpanded = Boolean(expanded[item.id]);
            return (
              <div key={item.id} className="accordion-item">
                <h3 className="accordion-heading">
                  <button
                    type="button"
                    id={`accordion-trigger-${item.id}`}
                    className="accordion-trigger"
                    aria-expanded={isExpanded}
                    aria-controls={`accordion-panel-${item.id}`}
                    data-testid={`accordion-trigger-${item.id}`}
                    onClick={() => toggleAccordion(item)}
                  >
                    <span>{item.heading}</span>
                    <span className="accordion-caret" aria-hidden="true">
                      ▸
                    </span>
                  </button>
                </h3>
                <div
                  id={`accordion-panel-${item.id}`}
                  role="region"
                  className="accordion-panel"
                  aria-labelledby={`accordion-trigger-${item.id}`}
                  data-testid={`accordion-panel-${item.id}`}
                  hidden={!isExpanded}
                >
                  <p>{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p role="status" className="result" data-testid="controls-tabs-result">
        {result || null}
      </p>
    </PageLayout>
  );
}

export const tabsPage: Page = mountReact(TabsPage);
