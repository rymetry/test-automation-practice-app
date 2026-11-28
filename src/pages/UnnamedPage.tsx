import { useState, type JSX } from 'react';
import type { Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { PageLayout } from '../ui/PageLayout';

const ICONS = ['✎', '✕', '⚙'] as const;

/**
 * 意図的にアクセシブル名を省いた練習用ページ。
 * アイコンボタン 3 つ、ラベル無しの入力欄、role/tabindex 無しの div ボタン、見出し無しの表、
 * href 無しの a 要素、ライブリージョン無しの結果表示を維持する。
 */
export function UnnamedPage(): JSX.Element {
  const [result, setResult] = useState('');

  return (
    <PageLayout
      title="Unnamed elements"
      intro="このページだけ、わざと名前の無い部品を置いています。getByRole に名前を渡せないので、順番、テキスト、data-testid、親要素からの絞り込みなど、名前以外の手がかりで指す練習に使ってください。他のページはすべて名前が付いています。"
      size="medium"
    >
      <section className="card">
        <h2>Icon buttons</h2>
        <p className="muted">3 つとも aria-label がありません。</p>
        <div className="row">
          {ICONS.map((icon) => (
            <button key={icon} type="button" className="btn-icon" onClick={() => setResult(`Clicked ${icon}`)}>
              {icon}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Input without a label</h2>
        <p className="muted">placeholder しかありません。</p>
        <input type="text" placeholder="Search..." />
      </section>

      <section className="card">
        <h2>Fake button</h2>
        <p className="muted">div にクリックハンドラを付けただけで、role も tabindex もありません。</p>
        <div className="btn" data-testid="fake-button" onClick={() => setResult('Clicked')}>
          Click me
        </div>
        <p className="muted" data-testid="unnamed-result">
          {result || null}
        </p>
      </section>

      <section className="card">
        <h2>Table without headers</h2>
        <table>
          <tbody>
            <tr>
              <td>Mark</td>
              <td>Otto</td>
              <td>28</td>
            </tr>
            <tr>
              <td>Jacob</td>
              <td>Thornton</td>
              <td>45</td>
            </tr>
            <tr>
              <td>Larry</td>
              <td>Bird</td>
              <td>18</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Link without href</h2>
        <p>
          詳しくは <a>Learn more</a> を参照（href が無いのでリンクのロールになりません）。
        </p>
      </section>
    </PageLayout>
  );
}

export const unnamedPage: Page = mountReact(UnnamedPage);
