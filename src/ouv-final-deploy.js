/* VICE OS OUV Final Deploy control. Backend is the sole authority. */
export function mountOuvFinalDeploy({ container, supabase, getAccessToken, endpoint = '/.netlify/functions/ouv-final-deploy' }) {
  if (!container || !supabase || typeof getAccessToken !== 'function') throw new Error('Missing OUV deployment dependencies');
  const root = document.createElement('section');
  root.setAttribute('aria-label', 'OUV final deployment');
  root.innerHTML = '<button type="button" class="btn btn-gold" data-ouv-deploy>◆ FINAL DEPLOY & REPAIR ALL</button><p data-ouv-status role="status" aria-live="polite">Ready to inspect and reconcile eligible OUV proposals.</p><pre data-ouv-receipt hidden></pre>';
  container.append(root);
  const button = root.querySelector('[data-ouv-deploy]');
  const status = root.querySelector('[data-ouv-status]');
  const receipt = root.querySelector('[data-ouv-receipt]');
  let running = false;
  button.addEventListener('click', async () => {
    if (running) return;
    running = true; button.disabled = true;
    status.textContent = 'Verifying governance, quorum, authorization, execution and reconciliation…';
    receipt.hidden = true;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Executive sign-in required.');
      const requestId = crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': requestId },
        body: JSON.stringify({ action: 'reconcile_ouv', request_id: requestId })
      });
      const result = await response.json();
      if (!response.ok || !result || !['verified', 'action_required', 'partially_repaired'].includes(result.status))
        throw new Error(result?.message || 'OUV deployment could not be verified.');
      status.textContent = result.status === 'verified' ? '✓ DEPLOYED & VERIFIED' : result.status === 'action_required' ? '⚠ ACTION REQUIRED' : '⚠ PARTIALLY REPAIRED';
      receipt.textContent = JSON.stringify({ status: result.status, receipt_id: result.receipt_id ?? null, ouv_version: result.ouv_version ?? null, checks: result.checks ?? [], issues: result.issues ?? [] }, null, 2);
      receipt.hidden = false;
    } catch (error) {
      status.textContent = '⚠ ACTION REQUIRED — ' + (error instanceof Error ? error.message : 'Unexpected error');
    } finally { running = false; button.disabled = false; }
  });
  return () => root.remove();
}
