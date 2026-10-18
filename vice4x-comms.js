'use strict';
/* Member-scoped presentation and preferences. Private messages remain in the
 * authorized database; no message bodies or signed avatar URLs are persisted. */
const ViceComms=(()=>{
 const defaults={answer:'click',privacy:'full',devicePreview:false,sound:true,haptics:true,ticker:true,screen:'1080',camera:'1080'};
 const choices={answer:['click','slide'],privacy:['full','sender','hidden'],screen:['1080','2160'],camera:['720','1080']};
 let owner=null,items=[],loaded=false,loading=false,paused=false,avatars=new Map(),seen=new Set(),readIds=new Set();
 function scope(){if(owner!==S.user?.id){clear();owner=S.user?.id||null;try{readIds=new Set(JSON.parse(localStorage.getItem('vice4x-read:'+owner)||'[]'));}catch{}}return owner;}
 function clear(){owner=null;items=[];loaded=false;loading=false;avatars.clear();seen.clear();readIds.clear();document.getElementById('vice4x-ticker')?.remove();document.getElementById('vice4x-notifications')?.remove();}
 function persistRead(){try{localStorage.setItem('vice4x-read:'+owner,JSON.stringify([...readIds].slice(-500)));}catch{}}
 function prefs(){scope();try{return {...defaults,...JSON.parse(localStorage.getItem('vice4x-comms:'+owner)||'{}')};}catch{return {...defaults};}}
 function set(key,value){if(!(key in defaults))return;if(choices[key]&&!choices[key].includes(value))return;if(typeof defaults[key]==='boolean')value=!!value;const p=prefs();p[key]=value;try{localStorage.setItem('vice4x-comms:'+owner,JSON.stringify(p));}catch{}document.getElementById('vice4x-alert')?.remove();renderTicker();if(document.getElementById('vice4x-notifications'))panel();}
 function imageUrl(raw){const s=String(raw||'');if(/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(s))return s;if(s.startsWith('profile-media:'))return avatars.get(s)||'';try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 function avatar(p,cls='up-av'){
  const src=imageUrl(p?.avatarUrl||p?.avatar_url),initial=p?.avatar||p?.avatarInitials||p?.avatar_initials||(p?.name||'?').slice(0,2).toUpperCase();
  return `<span class="${cls} vice-avatar">${src?`<img src="${esc(src)}" alt="${esc(p?.name||'Member')} profile picture" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:esc(initial)}</span>`;
 }
 async function resolveAvatars(list){
  const user=scope(),paths=[...new Set(list.map(p=>p.avatarUrl||p.avatar_url).filter(s=>typeof s==='string'&&s.startsWith('profile-media:')).map(s=>s.slice(14)))];
  if(!paths.length)return;
  const {data,error}=await sb.storage.from('vice-profile-media').createSignedUrls(paths,3600);
  if(user!==S.user?.id)return;if(error)throw error;
  for(const r of data||[])if(r.signedUrl)avatars.set('profile-media:'+r.path,r.signedUrl);
  const av=document.getElementById('userAvatar'),src=imageUrl(S.profile.avatarUrl);if(av&&src){av.textContent='';av.style.backgroundImage=`url("${src}")`;av.style.backgroundSize='cover';av.style.backgroundPosition='center';}
 }
 async function uploadAvatar(file){
  const user=scope(),epoch=authEpoch;
  if(!file||file.size>8*1024*1024)throw Error('Choose a profile image of 8 MB or less');
  const mime=file.type,ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[mime];
  if(!ext)throw Error('Choose a JPEG, PNG, WebP or animated GIF');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const magic=String.fromCharCode(...bytes),valid=mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes[0]===137&&magic.slice(1,4)==='PNG':mime==='image/gif'?/^GIF8[79]a/.test(magic):magic.startsWith('RIFF')&&magic.slice(8)==='WEBP';
  if(!valid)throw Error('Image format does not match the file');
  const url=URL.createObjectURL(file);
  try{await new Promise((ok,no)=>{const img=new Image();img.onload=()=>img.naturalWidth>0&&img.naturalHeight>0&&img.naturalWidth*img.naturalHeight<=40000000?ok():no(Error('Image dimensions exceed 40 megapixels'));img.onerror=()=>no(Error('This image could not be decoded'));img.src=url;});}finally{URL.revokeObjectURL(url);}
  if(epoch!==authEpoch||user!==S.user?.id)throw Error('Session changed; reopen your profile');
  if(APP_MODE==='SIM'){const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file);});await saveMemberProfile({avatarUrl:data});return;}
  const path=user+'/'+crypto.randomUUID()+'.'+ext;
  const {error}=await sb.storage.from('vice-profile-media').upload(path,file,{contentType:mime,upsert:false,cacheControl:'3600'});if(error)throw error;
  if(epoch!==authEpoch||user!==S.user?.id)throw Error('Session changed; profile update canceled');
  const avatarUrl='profile-media:'+path;await resolveAvatars([{avatarUrl}]);await saveMemberProfile({avatarUrl});
  await Realtime.publishProfile();
 }
 function preview(text){
  let s=String(text||'');
  if(/^VICE_CALL_V1:/.test(s))return 'Call update';
  if(/^ENCv\d+:/.test(s))return 'Encrypted message · open the conversation to retry';
  if(s.startsWith('VICE_MEDIA_V1:')){try{const m=JSON.parse(s.slice(14));return m.kind==='audio'?'Voice message':'Image attachment';}catch{return 'Attachment';}}
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,500)||'New message';
 }
 function shown(item,device=false){const p=prefs();return p.privacy==='hidden'?{title:'VICE4X',body:item.kind==='missed'?'Missed call':'New notification'}:{title:item.title,body:p.privacy==='full'&&(!device||p.devicePreview)?preview(item.body):item.kind==='missed'?'Missed call':'New message'};}
 function add(item){
  scope();if(!owner)return;if(item.id&&seen.has(item.id))return;
  if(item.id)seen.add(item.id);if(seen.size>1000)seen.delete(seen.values().next().value);
  const n={...item,id:item.id||crypto.randomUUID(),at:item.at||Date.now(),read:readIds.has(item.id),body:preview(item.body)};
  items.unshift(n);items=items.slice(0,100);renderTicker();return n;
 }
 function openItem(id){const item=items.find(x=>x.id===id);if(!item)return;item.read=true;readIds.add(id);persistRead();Notify.navigate(item.route);document.getElementById('vice4x-notifications')?.remove();renderTicker();}
 function markRead(ids){scope();for(const id of ids)readIds.add(id);items.forEach(n=>{if(readIds.has(n.id))n.read=true;});persistRead();renderTicker();}
 function renderTicker(){
  document.getElementById('vice4x-ticker')?.remove();if(!owner||!prefs().ticker)return;
  const pending=items.filter(x=>!x.read);if(!pending.length)return;
  const bar=document.createElement('aside');bar.id='vice4x-ticker';bar.setAttribute('aria-label','Notification ticker');
  const text=pending.slice(0,12).map(n=>{const s=shown(n);return `<button type="button" data-vc-item="${esc(n.id)}"><span class="vc-ticker-type">${n.kind==='missed'?'MISSED CALL':'MESSAGE'}</span><strong>${esc(s.title)}</strong><span>${esc(s.body)}</span></button>`;}).join('');
  bar.innerHTML=`<button class="vc-ticker-count" data-vc-panel aria-label="Open ${pending.length} unread notifications">${pending.length}<span>INBOX</span></button><div class="vc-ticker-window"><div class="vc-ticker-track ${paused?'paused':''}">${text}</div></div><button class="vc-ticker-pause" data-vc-pause aria-label="${paused?'Resume':'Pause'} scrolling">${paused?'▶':'Ⅱ'}</button>`;
  const track=bar.querySelector('.vc-ticker-track');track.style.setProperty('--ticker-duration',Math.max(18,pending.slice(0,12).reduce((n,x)=>n+shown(x).body.length,0)/7)+'s');
  document.body.append(bar);
 }
 function panel(){
  scope();document.getElementById('vice4x-notifications')?.remove();
  const el=document.createElement('section');el.id='vice4x-notifications';el.setAttribute('role','dialog');el.setAttribute('aria-label','Notifications');
  el.innerHTML=`<div class="band-head"><h2>Notifications</h2><button class="btn btn-g" data-vc-close aria-label="Close notifications">×</button></div><div class="actions"><button class="btn btn-xs btn-g" data-vc-read>Mark all read</button><button class="btn btn-xs btn-g" data-vc-settings>Privacy & calls</button><button class="btn btn-xs btn-g" data-vc-refresh>Refresh</button></div><div class="vc-notice-list">${items.length?items.map(n=>{const s=shown(n);return `<button class="vc-notice ${n.read?'read':''}" data-vc-item="${esc(n.id)}"><span class="vc-ticker-type">${n.kind==='missed'?'MISSED CALL':'MESSAGE'} · ${esc(new Date(n.at).toLocaleString())}</span><strong>${esc(s.title)}</strong><span>${esc(s.body)}</span></button>`;}).join(''):'<p class="meta">No notifications loaded. Refresh to check recent messages and missed calls.</p>'}</div><p class="meta">Preview privacy applies here and to the ticker. Device previews are separately opt-in.</p>`;
  document.body.append(el);el.querySelector('[data-vc-close]').focus();void restoreInbox();
 }
 async function restoreInbox(force=false){
  const user=scope();if(!user||APP_MODE!=='LIVE'||loading||loaded&&!force)return;loading=true;
  try{
   const {data,error}=await sb.rpc('vice_comms_inbox');if(error)throw error;if(user!==S.user?.id)return;
   for(const row of (data||[]).slice().reverse()){
    const route={receiverId:user,peerId:row.peer_id||null,channelId:row.channel_id||null};
    const thread=row.channel_id?'ch:'+row.channel_id:'dm:'+[user,row.peer_id].sort().join('|');
    const body=row.kind==='missed'?'Missed '+(row.media_mode==='video'?'video':'voice')+' call':await MsgCrypto.decrypt(thread,row.body);
    if(user!==S.user?.id)return;
    add({id:row.id,title:row.sender_name||'Member',body,kind:row.kind,route,at:new Date(row.created_at).getTime()});
   }
   loaded=true;if(document.getElementById('vice4x-notifications'))panel();
  }catch(e){if(user===S.user?.id)toast('Notification history: '+e.message,'warn');}finally{if(user===S.user?.id)loading=false;}
 }
 function settings(){const p=prefs();const sel=(key,label,opts)=>`<label class="field">${label}<select data-vc-pref="${key}">${opts.map(([v,t])=>`<option value="${v}" ${p[key]===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
  return `<section class="band"><div class="band-head"><h2>Calls & notification privacy</h2><button class="btn btn-g" data-vc-panel>Notification inbox</button></div><div class="v4x-fields">${sel('answer','Answer incoming calls',[['click','Click / tap to answer'],['slide','Slide to answer']])}${sel('privacy','Notification previews',[['full','Name and message'],['sender','Name only'],['hidden','Private · hide name and content']])}${sel('screen','Screen capture target',[['1080','Full HD · 1920 × 1080'],['2160','4K UHD · 3840 × 2160']])}${sel('camera','Video call target',[['720','HD · 1280 × 720'],['1080','Full HD · 1920 × 1080']])}</div><div class="vc-switches">${[['sound','Ringtone and message sound'],['haptics','Vibration on supported devices'],['ticker','Floating notification ticker'],['devicePreview','Show message content in device notifications']].map(([k,label])=>`<label><input type="checkbox" data-vc-pref="${k}" ${p[k]?'checked':''}>${label}</label>`).join('')}</div><p class="meta">Calls use your microphone; video is requested explicitly. Capture quality depends on the selected screen, device, browser and connection. iPhone browsers may not support screen capture or vibration; visual alerts remain available.</p></section>`;
 }
 const prevSettings=commsSettings;commsSettings=()=>prevSettings()+settings();
 document.addEventListener('click',e=>{
  const t=e.target.closest('[data-vc-item],[data-vc-panel],[data-vc-close],[data-vc-read],[data-vc-pause],[data-vc-settings],[data-vc-refresh]');if(!t)return;
  if(t.dataset.vcItem){openItem(t.dataset.vcItem);return;}
  if(t.hasAttribute('data-vc-panel'))panel();
  if(t.hasAttribute('data-vc-close'))document.getElementById('vice4x-notifications')?.remove();
  if(t.hasAttribute('data-vc-read')){items.forEach(n=>{n.read=true;readIds.add(n.id);});persistRead();renderTicker();panel();}
  if(t.hasAttribute('data-vc-pause')){paused=!paused;renderTicker();}
  if(t.hasAttribute('data-vc-settings')){document.getElementById('vice4x-notifications')?.remove();S.comms.tab='settings';go('comms');}
  if(t.hasAttribute('data-vc-refresh'))void restoreInbox(true);
 });
 document.addEventListener('change',e=>{const t=e.target;if(t.matches('[data-vc-pref]'))set(t.dataset.vcPref,t.type==='checkbox'?t.checked:t.value);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('vice4x-notifications')?.remove();});
 let avatarRetryAt=0;
 document.addEventListener('error',e=>{if(e.target.matches?.('.vice-avatar img')&&Date.now()-avatarRetryAt>60000&&S.user){avatarRetryAt=Date.now();void Realtime.refresh();}},{capture:true});
 document.addEventListener('input',e=>{if(e.target.matches('[data-member-search]')){const q=e.target.value.toLocaleLowerCase();e.target.closest('.band,.mb')?.querySelectorAll('[data-member-row]').forEach(r=>r.hidden=!r.textContent.toLocaleLowerCase().includes(q));}});
 function fitAmounts(){
  for(const el of document.querySelectorAll('[data-money-value]')){
   el.classList.add('vc-metal-number');el.style.fontSize='';
   const width=el.clientWidth,actual=el.scrollWidth,base=parseFloat(getComputedStyle(el).fontSize);
   if(width>0&&actual>width)el.style.fontSize=Math.max(9,Math.floor(base*width/actual)-1)+'px';
  }
 }
 let frame=0;const scheduleFit=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;fitAmounts();});};
 new MutationObserver(scheduleFit).observe(document.getElementById('view')||document.body,{childList:true,subtree:true});
 window.addEventListener('resize',scheduleFit,{passive:true});scheduleFit();
 document.addEventListener('pointermove',e=>{
  const el=e.target.closest('[data-money-value]');if(!el||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const r=el.getBoundingClientRect();el.style.setProperty('--shine-x',Math.round((e.clientX-r.left)/r.width*100)+'%');el.style.setProperty('--shine-y',Math.round((e.clientY-r.top)/r.height*100)+'%');
 },{passive:true});
 return {prefs,set,clear,avatar,imageUrl,resolveAvatars,uploadAvatar,preview,shown,add,panel,renderTicker,restoreInbox,fitAmounts,markRead};
})();
window.ViceComms=ViceComms;
