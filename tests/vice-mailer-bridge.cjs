'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const nodemailer=require('../server/node_modules/nodemailer');
const {Mailer,template,types}=require('../server/mailer');

test('all 14 issuer email templates render and escape untrusted member names',()=>{
 assert.equal(Object.keys(types).length,14,'Template set must remain complete');
 for(const kind of Object.keys(types)){
  const output=template(kind,{
   name:'<script>alert(1)</script>',inviter:'<img src=x onerror=alert(1)>',
   url:'https://vice4x.example.test/?q="onmouseover="x',cert_id:'CERT-001',
   program:'VICE',units:12.5
  });
  assert(output.subject.length>0,kind);
  assert(output.html.startsWith('<!doctype html>'),kind);
  assert(output.text.startsWith(output.subject.split(' · ')[0])||output.text.length>0,kind);
  assert(!output.html.includes('<script>alert(1)</script>'),kind);
  assert(!output.html.includes('<img src=x onerror=alert(1)>'),kind);
  assert(!output.html.includes('href="https://vice4x.example.test/?q="onmouseover'),kind);
 }
});
test('IRU certificate and distributions do not imply independently appraised value or cash settlement',()=>{
 const cert=template('TOKEN_CERTIFICATE_EMAIL',{cert_id:'IRU-1',kind:'VICE',units:100,verify_url:'https://vice4x.example.test/verify'});
 assert.match(cert.html,/internal accounting records/i);
 assert.match(cert.html,/not an appraisal/i);
 const pending=template('DISTRIBUTION_PENDING_EMAIL',{status:'PENDING'});
 assert.match(pending.html,/does not confirm cash settlement/i);
});
test('malicious or unsupported link schemes are not rendered as email buttons',()=>{
 for(const url of ['javascript:alert(1)','http://evil.test','data:text/html;base64,abc']){
  const out=template('WELCOME_EMAIL',{url});
  assert(!out.html.includes('<a href='),'Non-HTTPS action link must not be clickable');
 }
 assert.throws(()=>template('NONEXISTENT_TYPE'),/Unsupported email template/);
});
test('locked nodemailer dependency composes transport MIME without external SMTP',async()=>{
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const payload=template('WELCOME_EMAIL',{name:'Synthetic Member',role:'HOLDER',url:'https://vice4x.example.test'});
 const info=await transport.sendMail({from:'issuer@example.test',to:'member@example.test',...payload});
 const wire=info.message.toString('utf8');
 assert.match(wire,/From:.*issuer@example.test/);
 assert.match(wire,/To:.*member@example.test/);
 assert.match(wire,/VICE/);
 assert.match(wire,/multipart\/alternative/);
 transport.close();
});
test('mailer is disabled absent transport and production-only credentials',()=>{
 const m=new Mailer({email_rate_per_hour:100});
 if(!process.env.SMTP_HOST||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SMTP_FROM)
  assert.equal(m.enabled,false);
 assert.equal(m.maxPerHour,100);
});
