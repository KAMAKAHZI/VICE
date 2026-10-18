'use strict';
/* Deterministic institutional model. No broker execution, valuation attestation or capital custody. */
(function(root){
 const finite=(v,label,min=-1e15,max=1e15)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid '+label);return n;};
 const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
 function waterfall(input={}){
  const principal=finite(input.principal,'principal',.01,1e12),months=finite(input.months??3,'period',1,12);
  const gross=finite(input.grossProfit??0,'gross profit'),costs=finite(input.costs??0,'costs',0),carry=finite(input.lossCarry??0,'loss carry',0);
  const net=cents(gross-costs),baseline=cents(principal*.15*months/12),recoverable=Math.max(0,net-carry),alpha=cents(Math.max(0,recoverable-baseline));
  const partner=cents(alpha*.65),vice=cents(alpha-partner);
  return {principal,months,apr:.15,quarterlyRate:.0375,netProfit:net,baselineDue:baseline,lossRecovery:cents(Math.min(Math.max(net,0),carry)),remainingLossCarry:cents(Math.max(0,carry-net)),netAlpha:alpha,partnerUpside:partner,viceUpside:vice,partnerDue:cents(baseline+partner),baselineFundingGap:cents(Math.max(0,baseline-recoverable)),modelOnly:true};
 }
 function drawdown(opening,equity,netFlows=0,limit=10){
  opening=finite(opening,'month opening equity',.01);equity=finite(equity,'current equity',0);netFlows=finite(netFlows,'net flows');limit=finite(limit,'drawdown limit',10,12);
  const pct=Math.max(0,(opening-(equity-netFlows))/opening*100);return {drawdownPct:pct,limit,halt:pct>=limit};
 }
 function validateProposal(payload,current){
  const p=payload?.parameters||{},old=p.previous_baseline||{},next=p.target_scaled_tier||{},issues=[];
  const vals=[old.vice_ouv,old.v4x_ouv,next.vice_ouv,next.v4x_ouv];
  if(vals.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<=0||n>1e12))issues.push('INVALID_REFERENCE_VALUES');
  if(old.v4x_ouv!==old.vice_ouv*160||next.v4x_ouv!==next.vice_ouv*160||p.structural_ratio!==160)issues.push('RATIO_MUST_EQUAL_160');
  if(old.vice_ouv!==Number(current.vice_price)||old.v4x_ouv!==Number(current.v4x_price))issues.push('BASELINE_MISMATCH');
  if(!/^PROP-[A-Z0-9-]{8,100}$/.test(payload?.proposal_id||''))issues.push('INVALID_PROPOSAL_ID');
  return {valid:issues.length===0,issues,current:{vice:Number(current.vice_price),v4x:Number(current.v4x_price)},requested:next,referenceScale:Number(next.vice_ouv)/Number(current.vice_price),unitsChange:false};
 }
 const canonical=value=>value===null?'null':Array.isArray(value)?'['+value.map(canonical).join(',')+']':typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 async function sha256(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:canonical(value))));}
 async function verifySignature(jwk,message,signature){
  try{
   if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||jwk.d||!/^[A-Za-z0-9_-]{43}$/.test(jwk.x)||!/^[A-Za-z0-9_-]{43}$/.test(jwk.y)||typeof signature!=='string'||signature.length>120)return false;
   const bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));if(bytes.length!==64)return false;
   const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes,new TextEncoder().encode(message));
  }catch{return false;}
 }
 function normalizeLead(p,source='MANUAL'){
  const org=p.organization||{},str=(v,n=200)=>String(v??'').trim().slice(0,n),email=str(p.email,254).toLowerCase();
  const company=str(p.company||org.name),title=str(p.title),industry=str(org.industry||p.industry).toLowerCase();
  const tier=/family office|private equity|asset management|investment management/.test(industry+' '+company.toLowerCase())?'C':/venture|fintech|software/.test(industry)?'B':'A';
  return {source,source_id:str(p.id||p.source_id,100)||null,full_name:str(p.full_name||p.name||p.first_name)||'Name awaiting enrichment',company,title,email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null,email_status:p.email_status==='verified'?'PROVIDER_VERIFIED':'UNVERIFIED',phone:str(p.phone_number||p.phone,60)||null,hq_address:str(p.hq_address||[org.street_address,org.city,org.state,org.country].filter(Boolean).join(', '),500),linkedin:/^https:\/\/(www\.)?linkedin\.com\//i.test(p.linkedin_url||p.linkedin||'')?str(p.linkedin_url||p.linkedin,500):null,asset_tier:str(p.asset_tier||org.annual_revenue_printed||'Not supplied',100),tier,contact_basis:str(p.contact_basis,1000)};
 }
 function outreach(lead){
  const focus={A:'corporate treasury allocation',B:'strategic technology and infrastructure co-funding',C:'alternative investment due diligence'}[lead.tier]||'institutional financing';
  return {subject:'Structured Corporate Yield & Project Financing Partnership – Vice Capital Inc.',body:`Dear ${lead.full_name||'Institutional Partner'},\n\nI am Caasi Esteeses Adkins, Founder & Chief Executive Officer of Vice Capital Inc., established in 2019. We are inviting selected institutional partners to discuss ${focus}.\n\nOur proposed financing framework combines a 15% fixed annual contractual rate, payable quarterly, with 65% of eligible net algorithmic profits above the baseline hurdle allocated to the capital provider and 35% to Vice Capital. The strategy targets up to 5% monthly growth; this is an objective, not a forecast or guaranteed return. Costs and loss recovery are applied before calculating performance participation.\n\nSecurity, collateral, conversion rights and payment obligations depend on the negotiated and executed documents. A contractual rate does not eliminate issuer credit risk or risk of loss. Our planned execution controls include a 10–12% monthly drawdown threshold, subject to market gaps, slippage and infrastructure availability.\n\nWould you be available for a 10-minute discussion to review the draft terms, supporting evidence and applicable eligibility requirements?\n\nCaasi Esteeses Adkins\nFounder & Chief Executive Officer\nVice Capital Inc.\nTelegram: @KAHZI\n\nReply “unsubscribe” to decline further outreach.`};
 }
 const api={waterfall,drawdown,validateProposal,canonical,sha256,verifySignature,normalizeLead,outreach};root.ViceInstitutionalCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
