'use strict';
/* VICE OS transactional SMTP worker. Server-only secrets. 14 complete themed templates.
 * Expects PostgreSQL email_outbox; service key must NEVER be sent to browsers. */
const nodemailer=require('nodemailer');
const fs=require('node:fs');
const path=require('node:path');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const basic=k=>String(k||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,36);
function details(entries){return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #423723;border-radius:8px;background:#121317">${entries.map(([k,v])=>`<tr><td style="padding:12px 16px;border-bottom:1px solid #282726;font:13px Arial,sans-serif;color:#a3968e">${esc(k)}</td><td style="padding:12px 16px;border-bottom:1px solid #282726;text-align:right;font:13px monospace;color:#ecd28a">${esc(v)}</td></tr>`).join('')}</table>`;}
const types={
 WELCOME_EMAIL:p=>({title:'Welcome to VICE OS',intro:`Welcome, ${esc(p.name||'Member')}. Your authenticated VICE operating account is ready.`,items:[['Assigned role',p.role],['Invited by',p.inviter],['Membership code',p.invite_code]],cta:'Open VICE OS',url:p.url}),
 INVITE_EMAIL:p=>({title:'Invitation to VICE OS',intro:`${esc(p.inviter||'VICE Capital')} invited you to access the VICE OS platform.`,items:[['Role',p.role],['VIP eligibility',p.vip?'Enabled':'Not enabled'],['Invite code',p.invite_code],['Expires',p.expires_at]],cta:'Accept Invitation',url:p.url}),
 INVITE_REMINDER_EMAIL:p=>({title:'Reminder: VICE OS Invitation',intro:'Your previously issued invitation is awaiting acceptance.',items:[['Invite code',p.invite_code],['Role',p.role],['Expires',p.expires_at]],cta:'Accept Invitation',url:p.url}),
 COURSE_CERTIFICATE_EMAIL:p=>({title:'Academy Certificate Issued',intro:'Your official VICE4X Academy certificate was recorded in the issuer registry.',items:[['Certificate',p.cert_id],['Course',p.course],['Overall score',p.overall_score],['Issued at',p.issued_at]],cta:'Verify Academy Certificate',url:p.verify_url}),
 TOKEN_CERTIFICATE_EMAIL:p=>({title:'IRU Certificate Issued',intro:'A change in your internal IRU ledger is now documented by an issuer-verifiable certificate. Scan the printed QR code or open the record below.',items:[['Certificate ID',p.cert_id],['Type',p.kind],['Program',p.program],['Units',p.units],['Issuer reference basis','Internal; not an appraisal'],['Issued at',p.issued_at]],cta:'Verify IRU Holdings',url:p.verify_url,disclaimer:true}),
 DISTRIBUTION_EMAIL:p=>({title:'Recorded Distribution Paid',intro:'The VICE issuer recorded this distribution as paid. Confirm independent payment settlement using your bank statement.',items:[['Period',p.period],['Program',p.program],['Recorded amount',p.total],['Payment reference',p.payment_reference]],cta:'Review Distributions',url:p.url}),
 DISTRIBUTION_PENDING_EMAIL:p=>({title:'Distribution Recorded',intro:'A distribution entry was created in the VICE operating ledger. This does not confirm cash settlement.',items:[['Period',p.period],['Program',p.program],['Status',p.status],['Proposed amount',p.total]],cta:'View Distribution Record',url:p.url}),
 TIER_ASSIGNED_EMAIL:p=>({title:'VICE Tier Classification Updated',intro:'The issuer updated your contribution-based tier classification.',items:[['Previous tier',p.previous_tier],['Assigned tier',p.tier],['Basis',p.basis],['Reason',p.reason]],cta:'View My Record',url:p.url}),
 LEGACY_RECORDED_EMAIL:p=>({title:'Legacy Classification Recorded',intro:'Your historical stewardship classification was recorded separately from financial tier.',items:[['Legacy order',p.order],['Evidence',p.evidence],['Effective date',p.effective_at]],cta:'View My Record',url:p.url}),
 ENTRY_CLASS_RECORDED_EMAIL:p=>({title:'Original Entry Class Recorded',intro:'Your original participation class was entered in the institutional record.',items:[['Program',p.program],['Entry date',p.entry_date],['Instrument',p.instrument],['Contribution',p.contribution]],cta:'View My Record',url:p.url}),
 REVOCATION_EMAIL:p=>({title:'Certificate Revoked',intro:'The issuer has revoked the following certificate. Do not rely on old copies.',items:[['Certificate',p.cert_id],['Date',p.revoked_at],['Reason',p.reason]],cta:'Check Current Status',url:p.verify_url}),
 PASSWORD_RESET_EMAIL:p=>({title:'Reset Your VICE OS Password',intro:'A password reset was requested. Use the secure one-time recovery URL. If this was not you, ignore the message.',items:[['Expires',p.expires_at]],cta:'Reset Password',url:p.reset_url}),
 SECURITY_ALERT_EMAIL:p=>({title:'VICE OS Security Alert',intro:'A security-sensitive action was recorded on your account.',items:[['Action',p.action],['Device',p.device],['IP',p.ip],['Timestamp',p.at]],cta:'Review Security Settings',url:p.url}),
 NOTIFICATION_DIGEST_EMAIL:p=>({title:'VICE OS Notification Digest',intro:`${esc(p.count||0)} new notifications are available in your authenticated workspace.`,items:[['Messages',p.messages],['Certificates',p.certificates],['Distributions',p.distributions]],cta:'Open Notifications',url:p.url})
};
function template(kind,p={}){
  if(!types[kind])throw Error('Unsupported email template');
  const spec=types[kind](p),button=spec.url&&/^https:\/\//.test(spec.url)?`<a href="${esc(spec.url)}" style="display:inline-block;background:#c9a84c;color:#12100c;border-radius:5px;padding:13px 25px;text-decoration:none;font:600 14px Arial,sans-serif">${esc(spec.cta||'Open VICE OS')}</a>`:'';
  const legal=spec.disclaimer?'<p style="font:11px/1.6 Arial;color:#a3968e">IRUs are internal accounting records; issuer reference figures do not establish shares, appraised collateral values or transferable securities.</p>':'';
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.title)}</title></head><body style="margin:0;padding:0;background:#07080a;color:#ece8e1"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#07080a"><tr><td align="center" style="padding:34px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1115;border:1px solid #5a4a25;border-radius:14px"><tr><td align="center" style="padding:32px 30px 0"><div style="font:italic 34px Georgia,serif;color:#ecd28a;letter-spacing:10px">VICE</div><div style="font:11px monospace;color:#ae8d49;letter-spacing:7px">CAPITAL INC.</div></td></tr><tr><td style="padding:26px 30px"><h1 style="margin:0 0 15px;color:#ecd28a;font:italic 28px Georgia,serif">${esc(spec.title)}</h1><p style="font:15px/1.65 Arial,sans-serif;color:#c9c5bc">${spec.intro}</p>${details(spec.items||[])}<div style="padding:26px 0;text-align:center">${button}</div>${legal}</td></tr><tr><td style="padding:18px 30px;border-top:1px solid #342a1a;color:#928576;font:11px/1.6 Arial,sans-serif">VICE CAPITAL INC. · Issuer operational notice<br>Confirm sensitive actions on the official HTTPS site. Never email secrets or recovery phrases. Notification preferences are available in your member profile.</td></tr></table></td></tr></table></body></html>`;
  return {subject:`${spec.title}${p.cert_id?' · '+basic(p.cert_id):''}`,html,
    text:[spec.title,spec.intro,...(spec.items||[]).map(([k,v])=>`${k}: ${v??'—'}`),spec.url||''].join('\n')};
}
class Mailer{
  constructor(config){
    this.config=config;this.maxPerHour=Number(config.email_rate_per_hour)||100;
    this.sent=[];this.busy=false;
    this.url=process.env.SUPABASE_URL||'';
    this.key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
    this.transport=null;
    if(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD){
      this.transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,
        secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},
        tls:{minVersion:'TLSv1.2'}});
    }
    this.from=process.env.SMTP_FROM||'';
  }
  // Fail closed: configuring SMTP must not automatically release a historical outbox backlog.
  // Enable delivery only after queue review and an explicitly approved rollout.
  get enabled(){return process.env.VICE_MAILER_DELIVERY_ENABLED==='true'&&!!(this.transport&&this.url&&this.key&&this.from);}
  async api(pathname,opts={}){
    const response=await fetch(this.url.replace(/\/$/,'')+'/rest/v1/'+pathname,{
      ...opts,headers:{apikey:this.key,authorization:'Bearer '+this.key,'Content-Type':'application/json','Prefer':'return=representation',...(opts.headers||{})},signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Error('Email database operation failed HTTP '+response.status);
    return data;
  }
  async run(){
    if(!this.enabled||this.busy)return;
    this.busy=true;
    try{
      const jobs=await this.api('email_outbox?status=eq.PENDING&available_at=lte.'+encodeURIComponent(new Date().toISOString())+'&order=created_at.asc&limit=10');
      for(const job of jobs||[]){
        this.sent=this.sent.filter(t=>Date.now()-t<3600000);
        if(this.sent.length>=this.maxPerHour)break;
        const locked=await this.api('email_outbox?id=eq.'+encodeURIComponent(job.id)+'&status=eq.PENDING',{
          method:'PATCH',body:JSON.stringify({status:'SENDING',attempts:(job.attempts||0)+1})});
        if(locked.length!==1)continue;
        try{
          if(!/^\S+@\S+\.\S+$/.test(job.email_to)||job.email_to.length>254)throw Error('Invalid recipient');
          const {subject,html,text}=template(job.kind,job.payload||{});
          await this.transport.sendMail({from:this.from,to:job.email_to,subject,html,text});
          await this.api('email_outbox?id=eq.'+encodeURIComponent(job.id),{method:'PATCH',body:JSON.stringify({status:'SENT',sent_at:new Date().toISOString(),last_error:null})});
          this.sent.push(Date.now());
          process.stdout.write(JSON.stringify({event:'mail_sent',id:job.id,kind:job.kind,at:new Date().toISOString()})+'\n');
        }catch(err){
          const attempts=(job.attempts||0)+1,seconds=[30,300,1800][Math.min(attempts-1,2)];
          await this.api('email_outbox?id=eq.'+encodeURIComponent(job.id),{
            method:'PATCH',body:JSON.stringify({status:attempts>=3?'FAILED':'PENDING',
              available_at:new Date(Date.now()+seconds*1000).toISOString(),last_error:String(err.message).slice(0,300)})});
          process.stderr.write(JSON.stringify({event:'mail_retry',id:job.id,kind:job.kind,attempts,at:new Date().toISOString()})+'\n');
        }
      }
    }catch(err){process.stderr.write(JSON.stringify({event:'mailer_db_error',msg:err.message})+'\n');}
    finally{this.busy=false;}
  }
}
module.exports={Mailer,template,types};
