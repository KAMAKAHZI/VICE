'use strict';
/* VICE MEGA enhancement layer. All core auth and ledger routes live in index.html. */
(() => {
  const mediaPrefix='VICE_MEDIA_V1:';
  window.viceCommsBubble = function(text){
    const s=String(text??'');
    if(!s.startsWith(mediaPrefix))return esc(s);
    const m=/^VICE_MEDIA_V1:(audio\/webm|audio\/mp4|audio\/ogg|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=]{1,170000})$/.exec(s);
    if(!m)return '<em>Unsupported media attachment</em>';
    const uri='data:'+m[1]+';base64,'+m[2];
    return m[1].startsWith('image/')?
      `<img class="vice-media-img" loading="lazy" alt="Photo attachment" src="${uri}">`:
      `<audio class="vice-media-audio" controls preload="none" src="${uri}">Audio message</audio>`;
  };

  const originalChats=commsChats;
  commsChats=function(){
    const C=S.comms;
    if(!S.user)return '<p>Sign in to view communications.</p>';
    const dm=C.activeDm,ch=C.activeChannel;
    let list='';
    try{
      C.activeDm=null;C.activeChannel=null;
      list=originalChats();
    }finally{C.activeDm=dm;C.activeChannel=ch;}
    const detail=(dm||ch)?originalChats():
      `<section class="vice-comms-empty"><strong>VICE Member Network</strong><p>Select a channel or direct message to start a conversation. Gold radiance indicates Online; white indicates Do Not Disturb.</p><p class="note">Current legacy conversation encryption has not passed end-to-end security verification. Do not send secrets.</p></section>`;
    const onCall=Realtime.current()?.peer||null;
    const dock=(C.peers||[]).filter(p=>p.online).slice(0,8).map(p=>{
      const name=esc(p.name||'Member');
      const short=esc((p.avatar||p.name||'NA').slice(0,2).toUpperCase());
      const mood=p.status==='DND'?'dnd':'online';
      return `<button class="vice-peer-bubble ${mood}" data-act="comms-open-dm" data-peer-id="${esc(p.id)}" title="${name} · ${esc(p.status||'ONLINE')}"><span>${short}</span>${onCall===p.id?'<small>CALL</small>':''}</button>`;
    }).join('');
    return `<div class="vice-comms-shell"><aside class="vice-chat-list" aria-label="Conversations"><input class="vice-chat-search" data-vice-chat-search placeholder="Search channels and members" autocomplete="off" aria-label="Search conversations">${list}</aside><div class="vice-chat-thread">${dock?`<nav class="vice-peer-dock" aria-label="Members online">${dock}</nav>`:''}${detail}</div></div>`;
  };

  document.addEventListener('input',ev=>{
    const target=ev.target;
    if(!target.matches('[data-vice-chat-search]'))return;
    const q=target.value.trim().toLowerCase();
    const list=target.closest('.vice-chat-list');
    if(!list)return;
    list.querySelectorAll('button.row').forEach(row=>{
      row.hidden=Boolean(q&&!row.textContent.toLowerCase().includes(q));
    });
  });
  document.addEventListener('change',ev=>{
    if(ev.target.matches('[data-vice-presence]')){
      Realtime.chooseStatus(ev.target.value).then(()=>toast('Presence updated','success')).catch(e=>toast(e.message,'error'));
      return;
    }
    if(ev.target.matches('#viceMediaInput')){
      const file=ev.target.files?.[0];
      if(file)sendMediaFile(file).catch(e=>toast('Media not sent: '+e.message,'error'));
      ev.target.value='';
    }
  });
  function destination(){
    if(!S.user||S.tab!=='comms')throw Error('Open Communications and sign in');
    if(S.comms.activeDm)return {type:'dm',id:S.comms.activeDm};
    if(S.comms.activeChannel)return {type:'channel',id:S.comms.activeChannel};
    throw Error('Open a channel or DM first');
  }
  async function sendContentTo(d,s){
    if(d.type==='dm')await Realtime.sendDm(d.id,s);
    else await Realtime.send(d.id,s);
    if(S.tab==='comms')renderMain();
  }
  async function sendContent(s){return sendContentTo(destination(),s); }
  async function asData(file){
    return await new Promise((resolve,reject)=>{
      const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(Error('File read failed'));r.readAsDataURL(file);
    });
  }
  async function sendMediaFile(file){
    destination();
    const allowed=['image/jpeg','image/png','image/webp'];
    if(!allowed.includes(file.type))throw Error('Only JPEG, PNG and WebP images supported in this release');
    if(file.size>5*1024*1024)throw Error('Image exceeds the 5MB pre-compression limit');
    const img=await createImageBitmap(file);
    const ratio=Math.min(1,680/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    img.close?.();
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.70));
    if(!blob||blob.size>112000){
      canvas.width=Math.round(canvas.width*.65)||1;canvas.height=Math.round(canvas.height*.65)||1;
      const src=await createImageBitmap(file);
      canvas.getContext('2d').drawImage(src,0,0,canvas.width,canvas.height);src.close?.();
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.48));
    }
    if(!blob||blob.size>112000)throw Error('Attachment too large; reduce image size');
    const data=await asData(blob);
    await sendContent(mediaPrefix+data);
    toast('Image sent to conversation','success');
  }
  let recorder=null,recStream=null,recLimit=null,voiceD=null;
  async function toggleVoice(){
    destination();
    if(recorder&&recorder.state==='recording'){recorder.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording not supported in this browser');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    recStream=stream;
    const kind=['audio/webm;codecs=opus','audio/mp4','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!kind){stream.getTracks().forEach(t=>t.stop());throw Error('No supported audio recording format');}
    const rec=new MediaRecorder(stream,{mimeType:kind,audioBitsPerSecond:24000});
    recorder=rec;voiceD=destination();
    const pieces=[];
    rec.ondataavailable=e=>{if(e.data?.size)pieces.push(e.data)};
    rec.onerror=e=>toast('Recorder error: '+String(e.error?.message||'unknown'),'error');
    rec.onstop=async()=>{
      clearTimeout(recLimit);recStream?.getTracks().forEach(t=>t.stop());
      recStream=null;recorder=null;
      document.querySelectorAll('.vice-voice').forEach(b=>{b.classList.remove('recording');b.textContent='Mic'});
      try{
        const clip=new Blob(pieces,{type:kind.split(';')[0]});
        if(clip.size>110000)throw Error('Voice note too large; retry a shorter note');
        const data=await asData(clip);
        if(!voiceD)throw Error('Recording destination unavailable');
        await sendContentTo(voiceD,mediaPrefix+data);
        voiceD=null;
        toast('Voice message sent','success');
      }catch(e){toast('Voice note not sent: '+e.message,'error');}
    };
    rec.start(500);
    document.querySelectorAll('.vice-voice').forEach(b=>{b.classList.add('recording');b.textContent='Stop'});
    toast('Recording voice note — tap Stop (maximum 20 seconds)','info');
    recLimit=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},20000);
  }
  const prior=window.__viceAct;
  window.__viceAct=function(t,e){
    if(t.dataset?.act==='vice-attach'){document.getElementById('viceMediaInput')?.click();return;}
    if(t.dataset?.act==='vice-voice'){toggleVoice().catch(x=>toast('Microphone: '+x.message,'error'));return;}
    return prior?.(t,e);
  };
})();

// Optional EIP-1193 wallet integration — uses the user's separate wallet UI for approval.
(() => {
  const previousWallet=viewWallet;
  let addr='',chain='',balance='';
  viewWallet=function(el){
    previousWallet(el);
    if(!S.user)return;
    const panel=document.createElement('section');
    panel.className='band';
    panel.style.marginTop='18px';
    const connected=Boolean(addr);
    panel.innerHTML=`<div class="band-head"><h2>External EVM wallet</h2><span class="chip file">Provider-approved transactions</span></div>
      <p class="muted">Connect MetaMask or another installed EIP-1193 provider for real Ethereum-compatible balances and transaction signing. VICE OS never receives your private key.</p>
      <div class="actions" style="margin:12px 0"><button class="btn btn-gd" data-act="vice-evm-connect">${connected?'Refresh connection':'Connect external wallet'}</button></div>
      ${connected?`<p class="meta">Account: <code>${esc(addr)}</code> · Chain ${esc(chain)} · Native balance ${esc(balance)}</p>
      <div class="fields"><label class="field fc">Recipient EVM address<input id="viceEvmTo" placeholder="0x…" autocomplete="off"></label>
      <label class="field">Native coin amount<input id="viceEvmAmount" placeholder="0.01" inputmode="decimal"></label></div>
      <p class="note">Send uses your connected provider's active chain and native coin. You must review the recipient, network and fees in the wallet's confirmation screen. BTC and VICE/V4X tokens are not sent by this feature.</p>
      <button class="btn btn-p" data-act="vice-evm-send">Review transaction in wallet</button>`:''}
      <p class="note warn">Never enter a recovery phrase into Communications or broker forms. VICE IRU records are not automatically Ethereum ERC-20 token holdings.</p>`;
    el.appendChild(panel);
  };
  async function connect(){
    const eth=window.ethereum;
    if(!eth?.request)throw Error('No compatible external wallet installed. Install or open your chosen wallet browser.');
    const addresses=await eth.request({method:'eth_requestAccounts'});
    if(!Array.isArray(addresses)||!addresses[0])throw Error('Wallet access not granted');
    addr=addresses[0];
    chain=await eth.request({method:'eth_chainId'});
    const amount=await eth.request({method:'eth_getBalance',params:[addr,'latest']});
    balance=(Number(BigInt(amount))/1e18).toFixed(6);
    renderMain();
  }
  async function send(){
    if(!addr)throw Error('Connect wallet first');
    const to=(document.getElementById('viceEvmTo')?.value||'').trim();
    const raw=(document.getElementById('viceEvmAmount')?.value||'').trim();
    if(!/^0x[\da-fA-F]{40}$/.test(to))throw Error('Invalid EVM recipient address');
    if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw))throw Error('Use a positive amount with up to 18 decimals');
    const [whole,fract='']=raw.split('.');
    const wei=BigInt(whole)*10n**18n+BigInt(fract.padEnd(18,'0'));
    if(wei<=0n)throw Error('Amount must exceed zero');
    const network=await window.ethereum.request({method:'eth_chainId'});
    if(network!==chain)throw Error('Network changed. Reconnect before sending.');
    if(!confirm(`Open your external wallet to review a native-asset transfer of ${raw} units on chain ${network} to ${to}?`))return;
    const hash=await window.ethereum.request({method:'eth_sendTransaction',params:[{from:addr,to,value:'0x'+wei.toString(16)}]});
    toast('Transaction submitted: '+String(hash).slice(0,20)+'… Verify on-chain confirmation before treating it as settled.','success');
    await connect();
  }
  const prior=window.__viceAct;
  window.__viceAct=function(t,e){
    if(t.dataset?.act==='vice-evm-connect'){connect().catch(x=>toast('Wallet: '+x.message,'error'));return;}
    if(t.dataset?.act==='vice-evm-send'){send().catch(x=>toast('Transfer not sent: '+x.message,'error'));return;}
    return prior?.(t,e);
  };
})();
