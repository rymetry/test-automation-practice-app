import { useEffect, useRef, useState, type FormEvent, type JSX, type KeyboardEvent } from 'react';
import { summarize } from '../../ui/format';
import { PageLayout } from '../../ui/PageLayout';

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
export function InputsPage(): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [timeout, setTimeoutValue] = useState('30');
  const [result, setResult] = useState('');

  const comboboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  const query = inputValue.trim().toLowerCase();
  const filtered = COUNTRIES.filter((country) => country.toLowerCase().includes(query));
  const resolvedActiveIndex = isOpen && activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;
  const activeOptionId = resolvedActiveIndex >= 0 ? `country-option-${resolvedActiveIndex}` : undefined;

  const closeList = (): void => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const selectCountry = (country: string): void => {
    setSelectedCountry(country);
    setInputValue(country);
    closeList();
  };

  useEffect(() => {
    if (!isOpen || resolvedActiveIndex < 0) return;
    optionRefs.current[resolvedActiveIndex]?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, resolvedActiveIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const onOutsidePointerDown = (event: PointerEvent): void => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        closeList();
      }
    };
    document.addEventListener('pointerdown', onOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown);
    };
  }, [isOpen]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (filtered.length === 0) return;
      setActiveIndex((prev) => (prev < 0 || prev >= filtered.length ? 0 : (prev + 1) % filtered.length));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (filtered.length === 0) return;
      setActiveIndex((prev) => (prev <= 0 || prev >= filtered.length ? filtered.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && isOpen && resolvedActiveIndex >= 0) {
      const target = filtered[resolvedActiveIndex];
      if (!target) return;
      event.preventDefault();
      selectCountry(target);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeList();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    closeList();
    setResult(
      `Applied: ${summarize({
        country: inputValue.trim() || '(none)',
        emailNotifications: notifications,
        autoSave,
        timeout,
      })}`,
    );
  };

  optionRefs.current.length = filtered.length;

  return (
    <PageLayout
      title="Combobox & Controls"
      intro="ARIA 1.2 のコンボボックス、スイッチ、スライダーを組み合わせた設定フォームです。入力による候補の絞り込みや矢印キーでの選択、各コントロールの切り替えを送信すると結果が下に表示されます。変更はこの画面内だけで保持され、リロードすると初期状態に戻ります。"
      size="narrow"
    >
      <form className="card stack stack-wide" data-testid="controls-form" noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="country-input">Country</label>
          <div className="combobox" ref={comboboxRef}>
            <input
              id="country-input"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="country-listbox"
              aria-activedescendant={activeOptionId}
              autoComplete="off"
              data-testid="country-combobox"
              value={inputValue}
              onClick={() => setIsOpen(true)}
              onChange={(event) => {
                const nextValue = event.target.value;
                setInputValue(nextValue);
                if (nextValue.trim() !== selectedCountry) setSelectedCountry('');
                setActiveIndex(-1);
                setIsOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                if (isOpen) closeList();
              }}
            />
            <ul
              id="country-listbox"
              role="listbox"
              aria-label="Country suggestions"
              className="combobox-list"
              data-testid="country-listbox"
              hidden={!isOpen}
              onMouseDown={(event) => {
                // listbox 上（スクロールバーや 0 件表示を含む）の mousedown でフォーカス移動を抑止し、blur でリストが閉じないようにする。
                event.preventDefault();
              }}
            >
              {filtered.length === 0 ? (
                // 0 件表示には role="option" や role="status" を付けず、候補数やステータス判定を汚染しない。
                <li role="presentation" className="combobox-empty">
                  No matching countries
                </li>
              ) : (
                filtered.map((country, i) => (
                  <li
                    key={country}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    id={`country-option-${i}`}
                    role="option"
                    className={`combobox-option${i === resolvedActiveIndex ? ' is-active' : ''}`}
                    aria-selected={country === selectedCountry}
                    onClick={() => selectCountry(country)}
                  >
                    {country}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="switch-row">
          <button
            id="switch-notifications"
            type="button"
            role="switch"
            aria-checked={notifications}
            aria-labelledby="switch-notifications-label"
            className="switch"
            data-testid="switch-notifications"
            onClick={() => setNotifications((prev) => !prev)}
          >
            <span className="switch-thumb" aria-hidden="true" />
          </button>
          <label id="switch-notifications-label" htmlFor="switch-notifications" className="switch-label">
            Email notifications
          </label>
          <span className="switch-state" aria-hidden="true">
            {notifications ? 'On' : 'Off'}
          </span>
        </div>

        <div className="switch-row">
          <button
            id="switch-autosave"
            type="button"
            role="switch"
            aria-checked={autoSave}
            aria-labelledby="switch-autosave-label"
            className="switch"
            data-testid="switch-autosave"
            onClick={() => setAutoSave((prev) => !prev)}
          >
            <span className="switch-thumb" aria-hidden="true" />
          </button>
          <label id="switch-autosave-label" htmlFor="switch-autosave" className="switch-label">
            Auto-save
          </label>
          <span className="switch-state" aria-hidden="true">
            {autoSave ? 'On' : 'Off'}
          </span>
        </div>

        <div className="field">
          <div className="slider-head">
            <label htmlFor="timeout-slider">Timeout (seconds)</label>
            <span className="slider-value" data-testid="slider-timeout-value">
              {timeout}
            </span>
          </div>
          <input
            id="timeout-slider"
            className="slider"
            type="range"
            min="0"
            max="60"
            step="5"
            value={timeout}
            onChange={(event) => setTimeoutValue(event.target.value)}
            data-testid="slider-timeout"
          />
        </div>

        <div className="row">
          <button type="submit" data-testid="apply-controls">
            Apply settings
          </button>
        </div>

        <p role="status" className="result" data-testid="controls-result">
          {result || null}
        </p>
      </form>
    </PageLayout>
  );
}

