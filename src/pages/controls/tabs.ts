import { esc, q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

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
export const tabsPage: Page = (root) => {
  const view = page(
    'Tabs & Accordion',
    'タブとアコーディオンの操作練習です。タブはクリックと左右矢印キー・Home・End キーで切り替わります。アコーディオンは複数項目を同時に開いた状態にできます。変更はこの画面内だけで保持され、リロードすると初期状態に戻ります。',
    `
      <div class="card">
        <h2>Tabs</h2>
        <div class="tabs">
          <div role="tablist" aria-label="Sections" class="tablist" data-testid="tabs-list">
            ${TABS.map(
              (tab, index) => `
                <button
                  type="button"
                  id="tab-${tab.id}"
                  role="tab"
                  class="tab"
                  aria-selected="${index === 0 ? 'true' : 'false'}"
                  aria-controls="tabpanel-${tab.id}"
                  tabindex="${index === 0 ? '0' : '-1'}"
                  data-testid="tab-${tab.id}"
                >${esc(tab.label)}</button>
              `,
            ).join('')}
          </div>
          ${TABS.map(
            (tab, index) => `
              <div
                id="tabpanel-${tab.id}"
                role="tabpanel"
                class="tabpanel"
                aria-labelledby="tab-${tab.id}"
                data-testid="tabpanel-${tab.id}"
                ${index === 0 ? '' : 'hidden'}
              >
                <p>${esc(tab.body)}</p>
              </div>
            `,
          ).join('')}
        </div>
      </div>

      <div class="card">
        <h2>Accordion</h2>
        <div class="accordion" data-testid="accordion">
          ${ACCORDION_ITEMS.map(
            (item) => `
              <div class="accordion-item">
                <h3 class="accordion-heading">
                  <button
                    type="button"
                    id="accordion-trigger-${item.id}"
                    class="accordion-trigger"
                    aria-expanded="${item.initialOpen ? 'true' : 'false'}"
                    aria-controls="accordion-panel-${item.id}"
                    data-testid="accordion-trigger-${item.id}"
                  >
                    <span>${esc(item.heading)}</span>
                    <span class="accordion-caret" aria-hidden="true">▸</span>
                  </button>
                </h3>
                <div
                  id="accordion-panel-${item.id}"
                  role="region"
                  class="accordion-panel"
                  aria-labelledby="accordion-trigger-${item.id}"
                  data-testid="accordion-panel-${item.id}"
                  ${item.initialOpen ? '' : 'hidden'}
                >
                  <p>${esc(item.body)}</p>
                </div>
              </div>
            `,
          ).join('')}
        </div>
      </div>

      <p role="status" class="result" data-testid="controls-tabs-result"></p>
    `,
  );
  root.append(view);

  const result = q(view, '[data-testid="controls-tabs-result"]');
  const tabButtons = TABS.map((tab) => q<HTMLButtonElement>(view, `[data-testid="tab-${tab.id}"]`));
  const tabPanels = TABS.map((tab) => q<HTMLElement>(view, `[data-testid="tabpanel-${tab.id}"]`));

  function activateTab(index: number, focusTab: boolean): void {
    const target = TABS[index];
    const targetButton = tabButtons[index];
    if (!target || !targetButton) return;

    for (let i = 0; i < TABS.length; i++) {
      const button = tabButtons[i];
      const panel = tabPanels[i];
      if (!button || !panel) continue;
      const selected = i === index;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    }

    if (focusTab) targetButton.focus();
    result.textContent = `Selected tab: ${target.label}`;
  }

  for (let i = 0; i < tabButtons.length; i++) {
    const button = tabButtons[i];
    if (!button) continue;
    button.addEventListener('click', () => activateTab(i, false));
    button.addEventListener('keydown', (event) => {
      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (i + 1) % TABS.length;
      else if (event.key === 'ArrowLeft') nextIndex = (i - 1 + TABS.length) % TABS.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = TABS.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activateTab(nextIndex, true);
    });
  }

  for (const item of ACCORDION_ITEMS) {
    const trigger = q<HTMLButtonElement>(view, `[data-testid="accordion-trigger-${item.id}"]`);
    const panel = q<HTMLElement>(view, `[data-testid="accordion-panel-${item.id}"]`);
    trigger.addEventListener('click', () => {
      const nextExpanded = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(nextExpanded));
      panel.hidden = !nextExpanded;
      result.textContent = `${nextExpanded ? 'Expanded' : 'Collapsed'}: ${item.heading}`;
    });
  }
};
