/* VICE OS OUV executive control: backend and database are sole authorities.
 * Alternative mount helper for module-based Admin screens; static page uses
 * /vice-ouv-final-deploy.js. Both use the same verified API contract.
 */
export function mountOuvFinalDeploy({ container, getAccessToken, endpoint = '/.netlify/functions/ouv-final-deploy' }) {
  if (!container || typeof getAccessToken !== 'function') throw new Error('Missing executive OUV dependencies');
  const proposal_id = 'PROP-20261019-548A9057-34F';
  const root = document.createElement('section');
  root.setAttribute('aria-label', 'Executive OUV governance');
  const verify = document.createElement('button');
  const execute = document.createElement('button');
  verify.type = execute.type = 'button';
  verify.textContent = '◆ VERIFY OUV READINESS';
  execute.textContent = '◆ EXECUTE APPROVED OUV';
  execute.disabled = true;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Execution remains locked until all independently verified governance gates pass.';
  const receipt = document.createElement('pre');
  receipt.hidden = true;
  root.append(verify, execute, status, receipt);
  container.append(root);
  let busy = false, ready = false;
  async function run(action) {
    if (busy || (action === 'execute_ouv' && !ready)) return;
    if (action === 'execute_ouv' && !window.confirm(
      'Execute the approved management reference OUV adjustment? This is not independent FMV.'
    )) return;
    busy = true;
    ready = false;
    verify.disabled = execute.disabled = true;
    receipt.hidden = true;
    status.textContent = action === 'execute_ouv' ? 'Submitting authorized execution…' : 'Checking database governance gates…';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Executive sign-in required');
      const request_id = crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'Idempotency-Key': request_id },
        body: JSON.stringify({ action, proposal_id, request_id, ...(action === 'execute_ouv' ? { confirm: 'EXECUTE APPROVED OUV' } : {}) })
      });
      const result = await response.json();
      if (!result || !['verified', 'ready', 'action_required'].includes(result.status))
        throw new Error('Invalid server verification response');
      // A governance-ready response never overrides the independent
      // deployment kill switch. Missing fields fail closed.
      ready = response.ok && result.status === 'ready' &&
        result.checks?.server_execution_enabled === true;
      status.textContent = result.status === 'verified'
        ? '✓ Published and reconciled: management reference values only'
        : result.status === 'ready'
          ? (ready ? '✓ Ready for explicit authorized execution'
            : 'Governance checks passed; production execution remains disabled pending release authorization.')
          : response.status === 401
            ? 'SESSION EXPIRED — Sign in normally to recheck readiness; recorded executive approvals are unchanged.'
            : '⚠ ' + (result.message || 'Governance requirements not satisfied');
      receipt.textContent = JSON.stringify({
        proposal_id, status: result.status, issues: result.issues || [],
        checks: result.checks || null, ouv_version: result.ouv_version || null,
        receipt_id: result.receipt_id || null, management_reference_only: true
      }, null, 2);
      receipt.hidden = false;
    } catch (error) {
      ready = false;
      status.textContent = '⚠ ACTION REQUIRED — ' + (error?.message || 'Unexpected verification error');
    } finally {
      busy = false;
      verify.disabled = false;
      execute.disabled = !ready;
    }
  }
  verify.addEventListener('click', () => run('reconcile_ouv'));
  execute.addEventListener('click', () => run('execute_ouv'));
  return () => root.remove();
}
