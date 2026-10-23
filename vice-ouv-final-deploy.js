/* VICE OS — proposal-scoped OUV readiness + explicit executive execution.
 * Server/database enforce all authorization and publication gates.
 */
(() => {
  'use strict';
  const PROPOSAL = 'PROP-20261019-548A9057-34F';
  const endpoint = '/.netlify/functions/ouv-final-deploy';
  let busy = false;
  const getClient = () => {
    try { if (typeof sb !== 'undefined' && sb?.auth?.getSession) return sb; } catch { /* not defined */ }
    return [window.sb, window.supabaseClient, window._supabase].find(c => c?.auth?.getSession);
  };
  function mount() {
    if (document.getElementById('vice-ouv-final-deploy')) return;
    const nodes = document.querySelectorAll('div,section,article');
    let host = null;
    for (const n of nodes) {
      const t = n.textContent || '';
      if (n.children.length < 14 && t.length < 4500 && t.includes(PROPOSAL) &&
          /execution gates|executive authorizations|quorum/i.test(t)) { host = n; break; }
    }
    if (!host) return;
    const root = document.createElement('section');
    root.id = 'vice-ouv-final-deploy';
    root.setAttribute('aria-label', 'Executive OUV governance');
    root.style.cssText = 'margin:14px 0;padding:15px;border:1px solid #a88a3e;border-radius:12px;background:#15130e;color:#ecd28a';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px';
    const verify = document.createElement('button');
    const execute = document.createElement('button');
    for (const b of [verify, execute]) {
      b.type = 'button';
      b.style.cssText = 'flex:1 1 220px;min-height:46px;padding:12px;border:1px solid #c9a84c;border-radius:9px;background:#302710;color:#f5d77e;font-weight:700;cursor:pointer';
    }
    verify.textContent = '◆ VERIFY OUV READINESS';
    execute.textContent = '◆ EXECUTE APPROVED OUV';
    execute.disabled = true;
    execute.style.opacity = '0.5';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'white-space:pre-wrap;margin-top:10px;overflow-wrap:anywhere';
    status.textContent = 'Executive-only. Verify all governance conditions before an explicit execution. No holder quantities change.';
    const details = document.createElement('pre');
    details.hidden = true;
    details.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:12px;margin-top:10px';
    buttons.append(verify, execute);
    root.append(buttons, status, details);
    host.append(root);
    const setBusy = (value) => {
      busy = value; verify.disabled = value; execute.disabled = value || !root.dataset.ready;
      verify.style.opacity = value ? '0.5' : '1';
      execute.style.opacity = execute.disabled ? '0.5' : '1';
    };
    const action = async (kind) => {
      if (busy) return;
      if (kind === 'execute_ouv' && root.dataset.ready !== 'true') return;
      if (kind === 'execute_ouv' && !window.confirm(
        'Publish the CEO/CFO-approved OUV reference adjustment? This is a management reference, NOT independent FMV. This action does not change any holder unit quantities.'
      )) return;
      root.dataset.ready = '';
      setBusy(true);
      details.hidden = true;
      status.textContent = kind === 'execute_ouv' ? 'Submitting authorized OUV execution…' : 'Verifying governance, policy and public review…';
      try {
        const session = await getClient()?.auth?.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) throw new Error('Sign in with your executive account.');
        const request_id = crypto.randomUUID();
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'Idempotency-Key': request_id },
          body: JSON.stringify({ action: kind, proposal_id: PROPOSAL, request_id,
            ...(kind === 'execute_ouv' ? { confirm: 'EXECUTE APPROVED OUV' } : {}) })
        });
        const data = await response.json();
        if (!data || typeof data.status !== 'string') throw new Error('Invalid server response');
        root.dataset.ready = data.status === 'ready' ? 'true' : '';
        status.textContent = data.status === 'verified'
          ? '✓ OUV PUBLISHED AND RECONCILED — management reference values, not independent FMV.'
          : data.status === 'ready'
            ? '✓ ALL DATABASE GATES READY. Execution requires the authorized final click.'
            : '⚠ EXECUTION BLOCKED — ' + (data.message || 'Review outstanding conditions');
        const issues = data.issues || [];
        details.textContent = JSON.stringify({
          status: data.status, proposal_id: data.proposal_id || PROPOSAL,
          issues, checks: data.checks || null, ouv_version: data.ouv_version || null,
          receipt_id: data.receipt_id || null, management_reference_only: true
        }, null, 2);
        details.hidden = false;
        if (!response.ok && !issues.length) status.textContent += '\nServer returned HTTP ' + response.status;
      } catch (error) {
        root.dataset.ready = '';
        status.textContent = '⚠ ACTION REQUIRED — ' + (error?.message || 'Verification failed');
      } finally {
        setBusy(false);
      }
    };
    verify.addEventListener('click', () => action('reconcile_ouv'));
    execute.addEventListener('click', () => action('execute_ouv'));
  }
  const boot = () => {
    mount();
    const observer = new MutationObserver(() => {
      if (!document.getElementById('vice-ouv-final-deploy')) mount();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
