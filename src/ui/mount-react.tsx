import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import type { Page } from '../router';

/** 現行ルーターの Page 契約上で React コンポーネントをマウント・アンマウントする一時ブリッジ。 */
export function mountReact(Component: () => JSX.Element | null): Page {
  return (root) => {
    const reactRoot = createRoot(root);
    reactRoot.render(
      <StrictMode>
        <Component />
      </StrictMode>,
    );
    return () => {
      reactRoot.unmount();
    };
  };
}
