import { api, type Plan } from '../api';
import { refreshAuth } from '../auth';
import { html, q, setTitle } from '../dom';
import { navigate, type Page } from '../router';

export const billingPage: Page = async (root) => {
  setTitle('Billing');

  const me = await refreshAuth();
  if (!me) {
    navigate('/login');
    return;
  }

  const view = html(`
    <section>
      <h1>Billing</h1>
      <p role="status" data-testid="plan">Current plan: <strong data-testid="plan-name"></strong></p>
      <button type="button" data-testid="upgrade">Upgrade to Pro</button>
      <dialog data-testid="upgrade-dialog" aria-labelledby="upgrade-title">
        <h2 id="upgrade-title">Upgrade to Pro?</h2>
        <p>ワークスペースはすぐに Pro プランに切り替わります。</p>
        <div class="row">
          <button type="button" data-testid="confirm-upgrade">Confirm</button>
          <button type="button" data-testid="cancel-upgrade">Cancel</button>
        </div>
      </dialog>
    </section>
  `);
  root.append(view);

  const planName = q(view, '[data-testid="plan-name"]');
  const upgrade = q<HTMLButtonElement>(view, '[data-testid="upgrade"]');
  const dialog = q<HTMLDialogElement>(view, 'dialog');
  const confirm = q<HTMLButtonElement>(view, '[data-testid="confirm-upgrade"]');
  const cancel = q<HTMLButtonElement>(view, '[data-testid="cancel-upgrade"]');

  function show(plan: Plan): void {
    planName.textContent = plan;
    upgrade.hidden = plan === 'Pro';
  }

  upgrade.addEventListener('click', () => dialog.showModal());
  cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    const result = await api.upgrade();
    confirm.disabled = false;
    dialog.close();
    if (result.status === 200 && result.data) show(result.data.plan);
  });

  const result = await api.billing();
  show(result.data?.plan ?? 'Free');
};
