import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import { page, summarize } from '../../ui/page';

const COUNTRIES = [
  'Australia',
  'Brazil',
  'Canada',
  'France',
  'Germany',
  'India',
  'Japan',
  'Singapore',
  'United Kingdom',
  'United States',
] as const;

/** ARIA 1.2 コンボボックス・スイッチ・スライダーをまとめた設定フォーム。 */
export const inputsPage: Page = (root) => {
  const view = page(
    'Combobox & Controls',
    'ARIA 1.2 のコンボボックス、スイッチ、スライダーを組み合わせた設定フォームです。入力による候補の絞り込みや矢印キーでの選択、各コントロールの切り替えを送信すると結果が下に表示されます。変更はこの画面内だけで保持され、リロードすると初期状態に戻ります。',
    `
      <form class="card stack stack-wide" data-testid="controls-form" novalidate>
        <div class="field">
          <label for="country-input">Country</label>
          <div class="combobox">
            <input
              id="country-input"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="country-listbox"
              autocomplete="off"
              data-testid="country-combobox"
            />
            <ul
              id="country-listbox"
              role="listbox"
              aria-label="Country suggestions"
              class="combobox-list"
              data-testid="country-listbox"
              hidden
            ></ul>
          </div>
        </div>

        <div class="switch-row">
          <button
            id="switch-notifications"
            type="button"
            role="switch"
            aria-checked="true"
            aria-labelledby="switch-notifications-label"
            class="switch"
            data-testid="switch-notifications"
          >
            <span class="switch-thumb" aria-hidden="true"></span>
          </button>
          <label id="switch-notifications-label" for="switch-notifications" class="switch-label">Email notifications</label>
          <span class="switch-state" aria-hidden="true">On</span>
        </div>

        <div class="switch-row">
          <button
            id="switch-autosave"
            type="button"
            role="switch"
            aria-checked="false"
            aria-labelledby="switch-autosave-label"
            class="switch"
            data-testid="switch-autosave"
          >
            <span class="switch-thumb" aria-hidden="true"></span>
          </button>
          <label id="switch-autosave-label" for="switch-autosave" class="switch-label">Auto-save</label>
          <span class="switch-state" aria-hidden="true">Off</span>
        </div>

        <div class="field">
          <div class="slider-head">
            <label for="timeout-slider">Timeout (seconds)</label>
            <span class="slider-value" data-testid="slider-timeout-value">30</span>
          </div>
          <input
            id="timeout-slider"
            class="slider"
            type="range"
            min="0"
            max="60"
            step="5"
            value="30"
            data-testid="slider-timeout"
          />
        </div>

        <div class="row">
          <button type="submit" data-testid="apply-controls">Apply settings</button>
        </div>

        <p role="status" class="result" data-testid="controls-result"></p>
      </form>
    `,
    'narrow',
  );
  root.append(view);

  const form = q<HTMLFormElement>(view, '[data-testid="controls-form"]');
  const combobox = q(view, '.combobox');
  const input = q<HTMLInputElement>(view, '[data-testid="country-combobox"]');
  const listbox = q<HTMLUListElement>(view, '[data-testid="country-listbox"]');
  const notificationsSwitch = q<HTMLButtonElement>(view, '[data-testid="switch-notifications"]');
  const autosaveSwitch = q<HTMLButtonElement>(view, '[data-testid="switch-autosave"]');
  const slider = q<HTMLInputElement>(view, '[data-testid="slider-timeout"]');
  const sliderValue = q(view, '[data-testid="slider-timeout-value"]');
  const result = q(view, '[data-testid="controls-result"]');

  let isOpen = false;
  let filtered: string[] = [...COUNTRIES];
  let activeIndex = -1;
  let selectedCountry = '';

  function optionElements(): HTMLLIElement[] {
    return [...listbox.querySelectorAll<HTMLLIElement>('[role="option"]')];
  }

  function syncActiveOption(): void {
    const options = optionElements();
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (!option) continue;
      option.classList.toggle('is-active', i === activeIndex);
    }
    const active = activeIndex >= 0 ? options[activeIndex] : undefined;
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderOptions(): void {
    const query = input.value.trim().toLowerCase();
    filtered = COUNTRIES.filter((country) => country.toLowerCase().includes(query));
    listbox.innerHTML = '';

    if (filtered.length === 0) {
      activeIndex = -1;
      // 0 件表示には role="option" や role="status" を付けず、候補数やステータス判定を汚染しない。
      listbox.append(html('<li role="presentation" class="combobox-empty">No matching countries</li>'));
      syncActiveOption();
      return;
    }

    for (let i = 0; i < filtered.length; i++) {
      const country = filtered[i];
      if (!country) continue;
      const option = html<HTMLLIElement>(
        `<li id="country-option-${i}" role="option" class="combobox-option" aria-selected="${country === selectedCountry ? 'true' : 'false'}">${esc(country)}</li>`,
      );
      option.addEventListener('click', () => {
        selectCountry(country, option);
      });
      listbox.append(option);
    }

    if (activeIndex >= filtered.length) activeIndex = -1;
    syncActiveOption();
  }

  function openList(): void {
    renderOptions();
    isOpen = true;
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeList(): void {
    isOpen = false;
    activeIndex = -1;
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function selectCountry(country: string, clickedOption?: HTMLLIElement): void {
    selectedCountry = country;
    input.value = country;
    for (const option of optionElements()) {
      option.setAttribute('aria-selected', String(option === clickedOption || option.textContent === country));
    }
    closeList();
  }

  input.addEventListener('click', () => {
    openList();
  });

  input.addEventListener('input', () => {
    if (input.value.trim() !== selectedCountry) selectedCountry = '';
    activeIndex = -1;
    openList();
  });

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) openList();
      if (filtered.length === 0) return;
      activeIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % filtered.length;
      syncActiveOption();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) openList();
      if (filtered.length === 0) return;
      activeIndex = activeIndex <= 0 ? filtered.length - 1 : activeIndex - 1;
      syncActiveOption();
      return;
    }

    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      const target = filtered[activeIndex];
      if (!target) return;
      event.preventDefault();
      selectCountry(target);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeList();
    }
  });

  // listbox 上（スクロールバーや 0 件表示を含む）の mousedown でフォーカス移動を抑止し、blur でリストが閉じないようにする。
  listbox.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  input.addEventListener('blur', () => {
    if (isOpen) closeList();
  });

  function onOutsidePointerDown(event: PointerEvent): void {
    if (isOpen && !combobox.contains(event.target as Node)) closeList();
  }
  document.addEventListener('pointerdown', onOutsidePointerDown);

  function bindSwitch(button: HTMLButtonElement): void {
    const stateLabel = button.parentElement?.querySelector('.switch-state');
    button.addEventListener('click', () => {
      const nextChecked = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(nextChecked));
      if (stateLabel) stateLabel.textContent = nextChecked ? 'On' : 'Off';
    });
  }
  bindSwitch(notificationsSwitch);
  bindSwitch(autosaveSwitch);

  function syncSliderValue(): void {
    sliderValue.textContent = slider.value;
  }
  slider.addEventListener('input', syncSliderValue);
  slider.addEventListener('change', syncSliderValue);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    closeList();
    result.textContent = `Applied: ${summarize({
      country: input.value.trim() || '(none)',
      emailNotifications: notificationsSwitch.getAttribute('aria-checked') === 'true',
      autoSave: autosaveSwitch.getAttribute('aria-checked') === 'true',
      timeout: slider.value,
    })}`;
  });

  return () => {
    document.removeEventListener('pointerdown', onOutsidePointerDown);
  };
};
