'use strict';
/** VICE OS v1.3.8.0 token certificate release contracts.
 * Source regression only. Live issuer, SMTP and member security require separate acceptance. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),verify=read('verify.html');
const expected=['1.3.8.0-IRU-CERTIFICATES','const ViceTokenCertificates = (()=>{',
 'ViceTokenCertificates.htmlSection()','ViceTokenCertificates.load()',
 'data-act="iru-cert-preview"','data-act="iru-cert-download"',
 'data-act="iru-cert-verify"',"sb.rpc('issue_holdings_consolidation'",
 "sb.rpc('revoke_token_certificate'"];
for(const name of expected)assert(html.includes(name),'Missing frontend certificate path: '+name);
assert(verify.includes('verify_token_certificate'),'Public token verification missing');
for(const item of ['units_held_before','vice_reference_cents','v4x_reference_cents'])
 assert(verify.includes(item),'Verification omits issuer-signed snapshot field '+item);
const migrations=[
 '20261013052749_vice_1380_verified_portfolio_token_certificates.sql',
 '20261013053011_vice_1381_bind_all_certified_portfolio_fields.sql',
 '20261013053500_vice_1382_transactional_mail_outbox.sql',
 '20261013054800_vice_1383_distribution_certificate_on_issuer_paid.sql'
];
for(const file of migrations)assert(fs.existsSync(path.join(root,'supabase/migrations',file)),
 'Missing historical live Supabase migration in GitHub: '+file);
assert(read('supabase/migrations/'+migrations[0]).includes('token_cert_digest'));
assert(read('supabase/migrations/'+migrations[1]).includes('source_event_seq'));
assert(read('supabase/migrations/'+migrations[2]).includes('email_outbox'));
assert(read('supabase/migrations/'+migrations[3]).includes('trg_vice_distribution_certificate'));
const qrStart=html.indexOf('const ViceQR = (() => {'),qrEnd=html.indexOf('/* ═',qrStart+500);
const certStart=html.indexOf('const ViceBarcode = (()=>{'),
 certEnd=html.indexOf('// v1.0.3 deliberately retires',certStart);
assert(qrStart>0&&qrEnd>qrStart&&certStart>0&&certEnd>certStart,'Barcode implementation missing');
const ctx=vm.createContext({console,BigInt,Intl,Date,Number,URL,TextEncoder,
 esc:s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 location:{href:'https://vice4x.netlify.app/'},
 ViceCertificates:{cornerOrnament:()=>''},
 S:{tokenCerts:{list:[],kind:'ALL',program:'ALL'},profile:{},user:{}},
 window:{__viceAct:()=>{}},document:{addEventListener:()=>{}},
 $:()=>null,isOwner:()=>false,toast:()=>{},fmtD:x=>x});
vm.runInContext(html.slice(qrStart,qrEnd)+'\n'+html.slice(certStart,certEnd)+'\nthis.test={ViceQR,ViceBarcode,ViceTokenCertificates};',ctx,{timeout:6000});
const id='VCT-ABCD-1234-5678-EF90',url='https://vice4x.netlify.app/verify.html?id='+id;
const matrix=ctx.test.ViceQR.encode(url);
assert(matrix.size>=21&&matrix.size<=177,'Invalid QR dimensions');
assert(ctx.test.ViceBarcode.svg(id).includes('Code 39 barcode'),'Code39 barcode missing');
const cert={cert_id:id,kind:'ISSUANCE',program:'VICE',holder_name:'QA Holder',
 holder_client_id:'VC-TEST',units:'40',units_held_before:'60',units_held_after:'100',
 issued_at:'2026-10-13T12:00:00Z',value_basis:'INTERNAL_REFERENCE',
 holdings_snapshot:{vice_units:100,v4x_units:5,vice_reference_cents:200,v4x_reference_cents:32000,combined_reference_cents:180000,as_of:'2026-10-13T12:00:00Z'}};
const svg=ctx.test.ViceTokenCertificates.render(cert);
assert(svg.includes('2550')&&svg.includes('3300'),'Letter print dimensions missing');
assert(svg.includes('Combined internal reference'),'Snapshot render missing');
assert(svg.includes('Code 39 ID'),'Barcode ID missing');
console.log('PASS certificate source: QR, Code39, historical holdings, issuer RPC integration');
