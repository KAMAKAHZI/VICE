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

/* AcroForm editing: preserves originals; never edits signed PDFs or issues certificates. */
window.VicePdf = (()=>{
  let libraryTask=null;
  function library(){
    if(window.PDFLib)return Promise.resolve(window.PDFLib);
    if(!libraryTask)libraryTask=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.integrity='sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';
      script.crossOrigin='anonymous';
      script.onload=()=>resolve(window.PDFLib);
      script.onerror=()=>{script.remove();libraryTask=null;reject(Error('PDF engine unavailable; check connectivity and retry'));};
      document.head.appendChild(script);
    });
    return libraryTask;
  }
  function fields(pdf,lib){
    const form=pdf.getForm();
    if(form.hasXFA())throw Error('XFA forms require an external compatible editor');
    if(form.getFields().some(f=>f instanceof lib.PDFSignature))throw Error('Signature fields detected. Preserve this file and use its signing provider.');
    return form.getFields().filter(f=>!f.isReadOnly()).map(f=>{
      if(f instanceof lib.PDFTextField)return {name:f.getName(),kind:'text',value:f.getText()||'',max:f.getMaxLength()||10000};
      if(f instanceof lib.PDFCheckBox)return {name:f.getName(),kind:'checkbox',value:f.isChecked()};
      if(f instanceof lib.PDFDropdown||f instanceof lib.PDFRadioGroup)return {name:f.getName(),kind:'select',value:[f.getSelected()].flat()[0]||'',options:f.getOptions()};
      return null;
    }).filter(Boolean);
  }
  async function edit(bytes,values,lib){
    const pdf=await lib.PDFDocument.load(bytes);
    const editable=fields(pdf,lib),form=pdf.getForm();
    for(const item of editable){
      if(!Object.prototype.hasOwnProperty.call(values,item.name))continue;
      const field=form.getField(item.name),value=values[item.name];
      if(item.kind==='checkbox'){if(value===true)field.check();else if(value===false)field.uncheck();else throw Error('Checkbox value must be boolean');}
      if(item.kind==='text'){const text=String(value);if(text.length>item.max)throw Error('Field exceeds maximum length: '+item.name);field.setText(text);}
      if(item.kind==='select'){if(!item.options.includes(value))throw Error('Invalid selection: '+item.name);field.select(value);}
    }
    return pdf.save();
  }
  async function open(id){
    const epoch=authEpoch,owner=S.user?.id,doc=S.documents.find(d=>d.id===id);
    if(!owner||!doc?.url)throw Error('Sign in and select an available document');
    if(doc.signed)throw Error('Signed documents are immutable. Upload an authorized unsigned template.');
    if(doc.type!=='application/pdf')throw Error('Form editing supports PDF documents only');
    const current=()=>{if(epoch!==authEpoch||owner!==S.user?.id)throw Error('Session changed; reopen the document');};
    openModal('PDF form editor','<p role="status">Loading private document…</p>');
    const lib=await library();current();
    const downloaded=await sb.storage.from('vice-documents').download(doc.url);
    if(downloaded.error)throw downloaded.error;
    if(downloaded.data.size>10*1024*1024)throw Error('PDF exceeds 10 MB');
    const bytes=await downloaded.data.arrayBuffer();current();
    if(doc.sha256){
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      if(digest!==doc.sha256)throw Error('Document integrity mismatch; contact an administrator');
    }
    const pdf=await lib.PDFDocument.load(bytes),items=fields(pdf,lib);current();
    if(!items.length)throw Error('This PDF has no supported editable form fields. Full-page content editing requires an external PDF editor.');
    openModal('PDF form editor',`<p>${esc(doc.name)} · Original preserved. Text, date text, checkboxes and selections are supported.</p>
      <form id="vicePdfForm">${items.map((f,i)=>`<label class="ff" for="pdfField${i}">${esc(f.name)}${f.kind==='checkbox'?`<input id="pdfField${i}" type="checkbox" ${f.value?'checked':''}>`:f.kind==='select'?`<select id="pdfField${i}">${f.options.map(o=>`<option ${o===f.value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input id="pdfField${i}" value="${esc(f.value)}" maxlength="${f.max}">`}</label>`).join('')}</form>
      <p class="note">Review every field before export. Profile autofill uses your stored member profile and never supplies financial values.</p>
      <div class="mact"><button class="btn btn-g" id="pdfAutofill">Autofill profile</button><button class="btn btn-g" id="pdfExport">Export PDF</button><button class="btn btn-p" id="pdfSave">Save new copy</button></div><p id="pdfResult" role="status" aria-live="polite"></p>`);
    const form=$('vicePdfForm'),result=$('pdfResult');
    const values=()=>Object.fromEntries(items.map((f,i)=>[f.name,f.kind==='checkbox'?form.querySelector('#pdfField'+i).checked:form.querySelector('#pdfField'+i).value]));
    $('pdfAutofill').onclick=async()=>{
      try{current();const r=await sb.from('profiles').select('name,email,phone,member_id,client_id').eq('id',owner).single();if(r.error)throw r.error;current();
        const mapping={name:r.data.name,full_name:r.data.name,legal_name:r.data.name,email:r.data.email,phone:r.data.phone,member_id:r.data.member_id,client_id:r.data.client_id};
        let count=0;items.forEach((f,i)=>{const key=f.name.toLowerCase().replace(/\s+/g,'_');if(f.kind==='text'&&mapping[key]!=null){form.querySelector('#pdfField'+i).value=String(mapping[key]);count++;}});
        result.textContent=count+' fields filled. Review before saving.';
      }catch(e){result.textContent=e.message;}
    };
    let busy=false;
    async function output(save){
      if(busy)return;busy=true;
      try{
        current();const outputBytes=await edit(bytes,values(),lib);current();
        const name=doc.name.replace(/\.pdf$/i,'')+'-edited-'+new Date().toISOString().replace(/[:.]/g,'-')+'.pdf';
        const blob=new Blob([outputBytes],{type:'application/pdf'});
        if(!save){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);result.textContent='PDF exported. The original is unchanged.';return;}
        const newId=uuid(),storagePath=owner+'/'+newId+'/'+name.replace(/[^A-Za-z0-9._-]/g,'_');
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',outputBytes)),x=>x.toString(16).padStart(2,'0')).join('');current();
        const upload=await sb.storage.from('vice-documents').upload(storagePath,blob,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;current();
        const row={id:newId,name,type:'application/pdf',size:blob.size,url:storagePath,sha256:digest,uploaded_by:owner};
        const saved=await sb.from('documents').insert(row).select('id').single();
        if(saved.error)throw Error('File uploaded but document registration failed: '+saved.error.message+'; contact administration with reference '+newId);
        current();S.documents.unshift(denorm({...row,created_at:new Date().toISOString(),signed:false}));
        await audit('DOCUMENT_COPY_SAVED','Edited PDF copy of '+doc.id,'documents',newId);
        result.textContent='New private copy saved. Original retained.';
      }catch(e){result.textContent='PDF operation failed: '+e.message;}
      finally{busy=false;}
    }
    $('pdfExport').onclick=()=>output(false);$('pdfSave').onclick=()=>output(true);
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-act="doc-edit-form"]');if(!button)return;
    void open(button.dataset.id).catch(error=>{closeModal();toast(error.message,'error');});
  });
  return {fields,edit,open};
})();
