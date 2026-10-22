/* OUV governance repair control; mount adjacent to the active proposal. */
(() => {
  const proposalPattern = /PROP-20261019-548A9057-34F/;
  let busy = false;
  const mount = () => {
    if (document.getElementById('vice-ouv-final-deploy')) return;
    const nodes = [...document.querySelectorAll('div,section,article')];
    const host = nodes.find(n => n.children.length < 14 && proposalPattern.test(n.textContent || '') && (n.textContent || '').length < 4500 && /execution gates|executive authorizations|quorum/i.test(n.textContent || ''));
    if (!host) return;
    const wrap = document.createElement('div'); wrap.id = 'vice-ouv-final-deploy';
    wrap.style.cssText = 'margin:14px 0;padding:14px;border:1px solid #a88a3e;border-radius:12px;background:#15130e;color:#ecd28a';
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = '◆ FINAL DEPLOY & REPAIR ALL';
    button.style.cssText = 'width:100%;padding:14px;border:1px solid #c9a84c;border-radius:9px;background:#302710;color:#f5d77e;font-weight:700;cursor:pointer';
    const status = document.createElement('p'); status.setAttribute('role','status'); status.style.whiteSpace='pre-wrap';
    status.textContent = 'Check verified executive approvals and outstanding execution gates.';
    wrap.append(button,status); host.append(wrap);
    button.onclick = async () => {
      if(busy)return; busy=true;button.disabled=true;status.textContent='Checking authorization and execution gates…';
      try {
        const sb = window.sb || window.supabaseClient || window._supabase || window.supabase;
        const sessionResult = sb?.auth?.getSession ? await sb.auth.getSession() : null;
        const token = sessionResult?.data?.session?.access_token;
        if (!token) throw new Error('Sign in with your executive account to run the check.');
        const res=await fetch('/.netlify/functions/ouv-final-deploy',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({action:'reconcile_ouv',request_id:crypto.randomUUID()})});
        const data=await res.json();
        status.textContent=(data.message || 'Execution not verified')+(data.issues?.length?'\nRemaining: '+data.issues.join(', '):'');
      } catch(e){status.textContent='ACTION REQUIRED: '+(e?.message||'Could not verify execution');}
      finally{busy=false;button.disabled=false;}
    };
  };
  const observer=new MutationObserver(()=>{if(!document.getElementById('vice-ouv-final-deploy'))mount();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mount();observer.observe(document.body,{childList:true,subtree:true});});
  else{mount();observer.observe(document.body,{childList:true,subtree:true});}
})();
