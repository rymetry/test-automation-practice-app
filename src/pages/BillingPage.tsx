import { useEffect, useRef, useState, type JSX } from 'react';
import { useNavigate } from 'react-router';
import { api, type Plan } from '../api';
import { useAuth } from '../auth';
import { useDocumentTitle } from '../ui/PageLayout';

export function BillingPage(): JSX.Element | null {
  useDocumentTitle('Billing');
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void (async () => {
      const me = await refreshAuth();
      if (cancelled) return;
      if (!me) {
        void navigate('/login');
        return;
      }

      // プランを取得してから描画する（"Current plan:" だけの状態を見せない）。
      const current = await api.billing();
      if (cancelled) return;
      setPlan(current.data?.plan ?? 'Free');
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [refreshAuth, navigate]);

  if (plan === null) return null;

  async function handleConfirm(): Promise<void> {
    setUpgrading(true);
    const result = await api.upgrade();
    if (!mountedRef.current) return;
    setUpgrading(false);
    dialogRef.current?.close();
    if (result.status === 200 && result.data) {
      setPlan(result.data.plan);
    }
  }

  return (
    <section className="page-narrow">
      <h1>Billing</h1>
      <div className="card">
        <p role="status" data-testid="plan">
          Current plan: <strong data-testid="plan-name">{plan}</strong>
        </p>
        <button type="button" data-testid="upgrade" hidden={plan === 'Pro'} onClick={() => dialogRef.current?.showModal()}>
          Upgrade to Pro
        </button>
      </div>
      <dialog ref={dialogRef} data-testid="upgrade-dialog" aria-labelledby="upgrade-title">
        <h2 id="upgrade-title">Upgrade to Pro?</h2>
        <p>ワークスペースはすぐに Pro プランに切り替わります。</p>
        <div className="row">
          <button type="button" data-testid="confirm-upgrade" disabled={upgrading} onClick={() => void handleConfirm()}>
            Confirm
          </button>
          <button type="button" data-testid="cancel-upgrade" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>
    </section>
  );
}
