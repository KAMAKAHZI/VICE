// Isolated PostgreSQL 17 (PGlite), using schema-only legacy contracts and synthetic identities.
// npm install --no-save --package-lock=false @electric-sql/pglite@0.3.15
import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ROOT=id(1),CFO=id(2),MEMBER=id(3),OTHER=id(4),UNLINKED=id(5),APPOINTED=id(6);
const sessions=new Map([[ROOT,id(101)],[CFO,id(102)],[MEMBER,id(103)],[OTHER,id(104)],[UNLINKED,id(105)]]);
async function as(actor,fn,session=sessions.get(actor)){
 await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
 try{
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[actor||'',JSON.stringify(session?{session_id:session}:{})]);
  const r=await fn();await db.exec('COMMIT');return r;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function rpc(actor,name,args){
 const params=args.map((_,i)=>'$'+(i+1)).join(',');
 return as(actor,async()=>(await db.query(`select public.${name}(${params}) as result`,args)).rows[0].result);
}
const control=(a,h,act,cid=randomUUID())=>rpc(a,'vice_set_holder_control',[h,act,'Synthetic authorized regression action',cid]);
const transfer=(a,h,n,cid=randomUUID())=>rpc(a,'vice_transfer_own_iru',[h,'VICE',n,'Synthetic authorized regression transfer',cid]);
const issue=(a,h,n,cid=randomUUID())=>rpc(a,'append_iru_event',[JSON.stringify({type:'UNITS_ISSUED',holderId:h,program:'VICE',units:String(n),reason:'Synthetic issuance regression'}),cid]);
const row=async(q,args=[])=>(await db.query(q,args)).rows[0];
try{
 await db.exec(fs.readFileSync('tests/sql/vice-registry-baseline.sql','utf8'));
 const migration=fs.readFileSync('supabase/migrations/20261018030547_vice_registry_access_and_cfo_controls.sql','utf8');
 await check('Migration applies and repeats without changing permission boundaries',async()=>{await db.exec(migration);await db.exec(migration);const operations=fs.readFileSync('supabase/migrations/20261018050918_vice4x_member_operations.sql','utf8');await db.exec(operations);await db.exec(operations);});
 for(const [i,role] of [[1,'SUPER_ADMIN'],[2,'FINANCE_OFFICER'],[3,'HOLDER'],[4,'HOLDER'],[5,'HOLDER']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(i),`member${i}@example.test`]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions.get(id(i)),id(i)]);
  await db.query('insert into auth.refresh_tokens(user_id) values($1)',[id(i)]);
  await db.query('insert into public.profiles(id,name,email,username,role) values($1,$2,$3,$4,$5)',[id(i),`Synthetic ${i}`,`member${i}@example.test`,`Member${i}`,role]);
  if(i<5)await db.query("insert into public.holders(id,profile_id,user_id,name,email,client_id,status,vice_units,v4x_units) values($1,$1,$1,$2,$3,$4,'ACTIVE',$5,0)",[id(i),`Synthetic ${i}`,`member${i}@example.test`,`VC-TEST-${i}`,i===2?1000:0]);
 }
 await db.query("insert into public.holders(id,name,email,client_id,status,vice_units,v4x_units) values($1,'Appointed synthetic','  MEMBER5@EXAMPLE.TEST  ','VC-TEST-APPOINTED','ACTIVE',0,0)",[APPOINTED]);
 await db.exec("insert into public.iru_program_counters(program,issued,retired) values('VICE',1000,0),('V4X',0,0); insert into public.vice_dao_config(id,vice_price,v4x_price) values(1,2,320); insert into public.vice_estate_reserve_accounts(program,designated_units,unassigned_units,transferred_units) values('VICE',7500000,7500000,0),('V4X',7500000,7500000,0);");
 await check('Username lookup is case-insensitive and trims whitespace',async()=>{assert.equal((await db.query("select public.lookup_email_for_login('  mEmBeR2  ') as email")).rows[0].email,'member2@example.test');});
 await check('Existing appointed holder links by normalized email, without duplicate allocation',async()=>{
  const h=await rpc(UNLINKED,'get_or_create_holder',[]);assert.equal(h.id,APPOINTED);assert.equal(h.profile_id,UNLINKED);assert.equal(Number(h.vice_units),0);
  assert.equal((await rpc(UNLINKED,'get_or_create_holder',[])).id,APPOINTED);
 });
 await check('CFO can appoint holders, but duplicate email is rejected ignoring case',async()=>{
  const payload={type:'HOLDER_ADDED',holderId:id(7),name:'New synthetic',email:'NEW@EXAMPLE.TEST'};
  await rpc(CFO,'append_iru_event',[JSON.stringify(payload),randomUUID()]);
  assert.equal((await row('select email from public.holders where id=$1',[id(7)])).email,'new@example.test');
  await assert.rejects(rpc(CFO,'append_iru_event',[JSON.stringify({...payload,holderId:id(8),email:' new@example.test '}),randomUUID()]),/already uses this email/);
 });
 await check('CFO can issue from holder pool with authentic CFO attribution and certificate',async()=>{
  const r=await issue(CFO,MEMBER,125);
  assert.equal((await row('select actor_role from public.iru_events where seq=$1',[r.seq])).actor_role,'FINANCE_OFFICER');
  const c=await row('select issued_by,units,revoked from public.token_certificates where source_event_seq=$1',[r.seq]);assert.equal(c.issued_by,CFO);assert.equal(Number(c.units),125);assert.equal(c.revoked,false);
  const cap=await rpc(CFO,'vice_financial_release_capabilities',[]);assert.equal(cap.strategic_price_rpc_v133,true);
 });
 await check('CFO allocation approval/reservation/distribution stays within strategic pool',async()=>{
  const allocation=await rpc(CFO,'create_iru_allocation',[OTHER,'V4X',50,null]);
  await rpc(CFO,'advance_iru_allocation',[allocation,'APPROVE']);await rpc(CFO,'advance_iru_allocation',[allocation,'RESERVE']);
  const result=await rpc(CFO,'distribute_iru_allocation',[allocation,randomUUID()]);assert.equal(result.status,'DISTRIBUTED');
  const repeat=await rpc(CFO,'distribute_iru_allocation',[allocation,randomUUID()]);assert.equal(repeat.already_distributed,true);
  assert.equal(Number((await row('select v4x_units from public.holders where id=$1',[OTHER])).v4x_units),50);
 });
 await check('Direct issuance retries are idempotent and cannot exceed the 2,500,000 pool',async()=>{
  const cid=randomUUID();const first=await issue(CFO,MEMBER,2,cid);const again=await issue(CFO,MEMBER,2,cid);
  assert.equal(again.already_applied,true);assert.equal(again.seq,first.seq);
  await assert.rejects(issue(CFO,MEMBER,3,cid),/different operation/);
  await assert.rejects(issue(CFO,MEMBER,2500000),/pool exhausted|capacity/);
 });
 await check('CFO own-holdings transfer conserves supply and estate balances',async()=>{
  const before=await row("select issued from public.iru_program_counters where program='VICE'");
  const r=await transfer(CFO,MEMBER,100);assert.equal(Number(r.source_units_after),900);assert.equal(Number(r.target_units_after),227);
  assert.equal((await row("select issued from public.iru_program_counters where program='VICE'")).issued,before.issued);
  const estate=await row("select * from public.vice_estate_reserve_accounts where program='VICE'");assert.equal(Number(estate.unassigned_units),7500000);assert.equal(Number(estate.transferred_units),0);
  assert.equal((await row("select count(*)::int as n from public.iru_events where payload->>'transferId'=$1",[r.correlation_id])).n,2);
 });
 await check('Transfer retries are idempotent and mismatched reuse is rejected',async()=>{
  const cid=randomUUID();const first=await transfer(CFO,MEMBER,20,cid);const repeat=await transfer(CFO,MEMBER,20,cid);
  assert.equal(repeat.already_applied,true);assert.equal(repeat.seq_out,first.seq_out);assert.equal(repeat.seq_in,first.seq_in);
  await assert.rejects(transfer(CFO,MEMBER,21,cid),/different operation/);
 });
 await check('Ordinary holders, overdrafts and self-transfers cannot move units',async()=>{
  await assert.rejects(transfer(MEMBER,CFO,1),/CFO or reserve administrator/);
  await assert.rejects(transfer(CFO,MEMBER,100000),/exceeds/);
  await assert.rejects(transfer(CFO,CFO,1),/different recipient/);
  await assert.rejects(issue(MEMBER,OTHER,1),/CFO or reserve administrator/);
 });
 await check('CFO cannot control root administrator or estate balances',async()=>{
  for(const action of ['LOCK','UNLOCK','SUSPEND','RESUME'])await assert.rejects(control(CFO,ROOT,action),/protected/);
  await assert.rejects(issue(CFO,ROOT,1),/protected/);
  await assert.rejects(transfer(CFO,ROOT,1),/reserve authorization/);
  await assert.rejects(rpc(CFO,'vice_estate_create_allocation',[MEMBER,'VICE',1,'Synthetic forbidden estate allocation']),/SUPER_ADMIN/);
  await assert.rejects(rpc(CFO,'vice_assign_member_role',[MEMBER,'SUPER_ADMIN','Synthetic escalation denied']),/SUPER_ADMIN/);
 });
 await check('CFO cannot revoke membership; root can',async()=>{
  await assert.rejects(control(CFO,MEMBER,'REVOKE'),/Only the reserve administrator/);
  const r=await control(ROOT,OTHER,'REVOKE');assert.ok(r.seq);
  assert.equal((await rpc(OTHER,'vice_member_access_status',[])).allowed,false);
  await assert.rejects(control(CFO,OTHER,'RESUME'),/restore revoked/);
  await control(ROOT,OTHER,'RESTORE');
 });
 await check('Freeze blocks transfers and issuance without ending account access',async()=>{
  await control(CFO,MEMBER,'LOCK');assert.equal((await rpc(MEMBER,'vice_member_access_status',[])).allowed,true);
  await assert.rejects(transfer(CFO,MEMBER,1),/unlocked/);await assert.rejects(issue(CFO,MEMBER,1),/locked/);
  await assert.rejects(as(ROOT,()=>db.query("insert into public.vice_estate_holder_balances(program,holder_id,units) values('VICE',$1,1)",[MEMBER])),/locked/);
  await control(CFO,MEMBER,'UNLOCK');
 });
 await check('Root can freeze CFO and still controls strategic and estate allocation workflows',async()=>{
  await control(ROOT,CFO,'LOCK');await assert.rejects(transfer(CFO,MEMBER,1),/unlocked/);
  await issue(ROOT,MEMBER,5);
  const a=await rpc(ROOT,'vice_estate_create_allocation',[MEMBER,'VICE',10,'Synthetic estate authorization']);assert.ok(a);
  await control(ROOT,CFO,'UNLOCK');
 });
 await check('Control retry is idempotent and balances are preserved',async()=>{
  const before=await row('select vice_units,v4x_units from public.holders where id=$1',[CFO]);const cid=randomUUID();
  const first=await control(ROOT,CFO,'SUSPEND',cid);const second=await control(ROOT,CFO,'SUSPEND',cid);
  assert.equal(second.already_applied,true);assert.equal(second.seq,first.seq);
  assert.deepEqual(await row('select vice_units,v4x_units from public.holders where id=$1',[CFO]),before);
 });
 await check('Suspension revokes sessions and denies reads, writes and security-definer RPCs',async()=>{
  assert.equal((await row('select count(*)::int as n from auth.sessions where user_id=$1',[CFO])).n,0);
  assert.equal((await row('select count(*)::int as n from auth.refresh_tokens where user_id=$1',[CFO])).n,0);
  const s=await rpc(CFO,'vice_member_access_status',[]);assert.equal(s.allowed,false);assert.equal(s.suspended,true);
  await assert.rejects(issue(CFO,MEMBER,1),/suspended, revoked, or expired/);
  await assert.rejects(transfer(CFO,MEMBER,1),/suspended, revoked, or expired/);
  assert.equal((await as(CFO,()=>db.query('select * from public.holders'))).rows.length,0);
  assert.equal((await as(CFO,()=>db.query('select * from public.list_member_directory()'))).rows.length,0);
 });
 await check('Resuming requires fresh login; stale access JWT remains invalid',async()=>{
  await control(ROOT,CFO,'RESUME');assert.equal((await rpc(CFO,'vice_member_access_status',[])).allowed,false);
  sessions.set(CFO,randomUUID());await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions.get(CFO),CFO]);
  assert.equal((await rpc(CFO,'vice_member_access_status',[])).allowed,true);
  await assert.rejects(control(ROOT,CFO,'RESUME'),/not in the selected restricted state/);
 });
 await check('Profile access flags cannot be changed through a generic UPDATE grant',async()=>{
  await db.exec('CREATE POLICY fixture_self_profile_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());');
  await assert.rejects(as(MEMBER,()=>db.query('update public.profiles set account_suspended=true where id=$1',[MEMBER])),/authorized registry control/);
 });
 await check('Deleted auth identity cannot reuse a JWT for data or RPC access',async()=>{
  await db.query('delete from auth.users where id=$1',[UNLINKED]);
  assert.equal((await rpc(UNLINKED,'vice_member_access_status',[])).allowed,false);
  await assert.rejects(rpc(UNLINKED,'get_or_create_holder',[]),/suspended, revoked, or expired/);
 });
 await check('Holder-linked event RLS works when holder ID differs from auth ID',async()=>{
  await issue(ROOT,APPOINTED,1);
  // Recreate only the disposable auth identity/session to inspect its own event.
  await db.query('insert into auth.users(id,email) values($1,$2)',[UNLINKED,'member5@example.test']);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions.get(UNLINKED),UNLINKED]);
  const events=await as(UNLINKED,()=>db.query('select payload from public.iru_events'));
  assert.ok(events.rows.length>0);assert.ok(events.rows.every(e=>e.payload.holderId===APPOINTED));
 });
 await check('CFO correction revokes an issuance certificate and retains source history',async()=>{
  const issued=await issue(CFO,MEMBER,7);
  const correction=await rpc(CFO,'reverse_strategic_issuance',[issued.seq,MEMBER,'VICE',7,'Synthetic explicitly authorized correction']);assert.ok(correction.seq);
  assert.equal((await row('select revoked from public.token_certificates where source_event_seq=$1',[issued.seq])).revoked,true);
  assert.equal((await row('select actor_role from public.iru_events where seq=$1',[correction.seq])).actor_role,'FINANCE_OFFICER');
 });


 await check('Only root configures HTTPS provider and live booking links',async()=>{
  await assert.rejects(rpc(CFO,'vice4x_save_services',[{},null]),/administrator/);
  await assert.rejects(rpc(ROOT,'vice4x_save_services',[{'svc-001':'javascript:alert(1)'},null]),/HTTPS/);
  await assert.rejects(rpc(ROOT,'vice4x_save_services',[{},'https://evil.test/calendar']),/booking link/);
  assert.equal((await rpc(ROOT,'vice4x_save_services',[{'svc-001':'https://www.inspirato.com/'},'https://calendar.google.com/calendar/appointments/schedules/test-fixture'])).saved,true);
 });
 await check('Reserve certificate accepts one entity, is idempotent, and supersedes prior designation',async()=>{
  await assert.rejects(rpc(CFO,'vice_issue_reserve_certificate',['VICE CAPITAL INC',randomUUID()]),/administrator/);
  await assert.rejects(rpc(ROOT,'vice_issue_reserve_certificate',['VICE CAPITAL INC / ADKINS ESTATE TRUST',randomUUID()]),/exactly one/);
  const cid=randomUUID();const c=await rpc(ROOT,'vice_issue_reserve_certificate',['VICE CAPITAL INC',cid]);
  assert.equal((await rpc(ROOT,'vice_issue_reserve_certificate',['VICE CAPITAL INC',cid])).cert_id,c.cert_id);
  assert.equal((await rpc(ROOT,'vice_issue_reserve_certificate',['VICE CAPITAL INC',randomUUID()])).cert_id,c.cert_id);
  await assert.rejects(rpc(ROOT,'vice_issue_reserve_certificate',['ADKINS ESTATE TRUST',cid]),/different operation/);
  const updated=await rpc(ROOT,'vice_issue_reserve_certificate',['ADKINS ESTATE TRUST',randomUUID()]);assert.notEqual(c.cert_id,updated.cert_id);
  const record=await row('select * from public.token_certificates where cert_id=$1',[updated.cert_id]);assert.equal(record.holder_name,'ADKINS ESTATE TRUST');assert.equal(Number(record.holdings_snapshot.vice_units),7500000);
  assert.equal((await row("select count(*)::int n from public.token_certificates where kind='RESERVE' and not revoked")).n,1);
  assert.equal((await rpc(ROOT,'verify_token_certificate',[c.cert_id])).reason,'REVOKED');
  const check=await rpc(ROOT,'verify_token_certificate',[updated.cert_id]);assert.equal(check.valid,true);assert.equal(check.holder_name,undefined);assert.equal(check.snapshot,undefined);
 });
 await check('Academy tracker derives progress, exam passes and active award independently',async()=>{
  await assert.rejects(rpc(MEMBER,'vice_academy_member_status',[]),/administrator/);
  const before=(await rpc(CFO,'vice_academy_member_status',[])).find(r=>r.id===MEMBER);assert.equal(Number(before.chapters_completed),0);assert.equal(before.certificate_id,null);
  await db.query("insert into public.academy_progress(profile_id,module,chapter) values($1,'I',1)",[MEMBER]);
  await db.query("insert into public.academy_attempts(profile_id,module,correct,total,score,passed) values($1,'I',4,4,100,true),($1,'II',1,4,25,false)",[MEMBER]);
  const after=(await rpc(ROOT,'vice_academy_member_status',[])).find(r=>r.id===MEMBER);assert.equal(Number(after.chapters_completed),1);assert.equal(Number(after.exams_passed),1);assert.equal(after.certificate_id,null);
 });
 const DOC=id(201),OTHERDOC=id(202),reason='Synthetic agreement evidence and administrator review';
 await db.query('insert into public.documents(id,name,uploaded_by,holder_id,sha256) values($1,$2,$3,$4,$5)',[DOC,'Synthetic signed agreement.pdf',MEMBER,MEMBER,'a'.repeat(64)]);
 await db.query('insert into public.documents(id,name,uploaded_by,holder_id,sha256) values($1,$2,$3,$4,$5)',[OTHERDOC,'Other private agreement.pdf',CFO,CFO,'b'.repeat(64)]);
 const loan={lender_name:'Synthetic Bank',lender_type:'FINANCIAL_INSTITUTION',lender_contact:'fixture@example.test',loan_reference:'FIXTURE-ONLY',program:'VICE',pool:'STRATEGIC',units:50,currency:'USD',principal:100,annual_rate:5.5,appraisal_value:400,appraiser:'Synthetic appraiser',appraisal_date:new Date().toISOString().slice(0,10),maturity_date:'2099-01-01',agreement_document_id:DOC,terms:reason};
 let loanId;
 await check('Holder submits own evidence, calculated LTV and idempotent pledge reservation',async()=>{
  await assert.rejects(rpc(MEMBER,'vice_submit_lending_record',[{...loan,agreement_document_id:OTHERDOC},randomUUID()]),/Upload your agreement/);
  await assert.rejects(rpc(MEMBER,'vice_submit_lending_record',[{...loan,units:1.5},randomUUID()]),/whole units/);
  await assert.rejects(rpc(MEMBER,'vice_submit_lending_record',[{...loan,units:2500000},randomUUID()]),/available recorded/);
  const cid=randomUUID();const r=await rpc(MEMBER,'vice_submit_lending_record',[loan,cid]);loanId=r.id;assert.equal(Number(r.ltv),25);assert.equal(r.status,'SUBMITTED');
  assert.equal((await rpc(MEMBER,'vice_submit_lending_record',[loan,cid])).id,loanId);
  await assert.rejects(rpc(MEMBER,'vice_submit_lending_record',[{...loan,principal:50},cid]),/different operation/);
 });
 sessions.set(OTHER,randomUUID());await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions.get(OTHER),OTHER]);
 await check('Lending privacy and committed-unit floor are enforced by the database',async()=>{
  const own=await as(MEMBER,()=>db.query('select * from public.vice_lending_records'));assert.equal(own.rows.length,1);
  const hidden=await as(OTHER,()=>db.query('select * from public.vice_lending_records'));assert.equal(hidden.rows.length,0);
  await assert.rejects(as(MEMBER,()=>db.query("update public.vice_lending_records set status='RELEASED' where id=$1",[loanId])),/permission denied/);
  await assert.rejects(db.query('update public.holders set vice_units=49 where id=$1',[MEMBER]),/collateral commitment/);
  await assert.rejects(rpc(OTHER,'vice_advance_lending_record',[loanId,'CANCELLED',reason,null,null,randomUUID()]),/Access denied/);
  await assert.rejects(rpc(MEMBER,'vice_advance_lending_record',[loanId,'ACTIVE',reason,DOC,null,randomUUID()]),/not authorized/);
 });
 await check('Default requires evidence and cure window; dispute blocks enforcement; no asset moves',async()=>{
  const advance=(action,doc=DOC,cure=null,actor=ROOT)=>rpc(actor,'vice_advance_lending_record',[loanId,action,reason,doc,cure,randomUUID()]);
  const before=await row('select vice_units,v4x_units from public.holders where id=$1',[MEMBER]);
  await assert.rejects(advance('ACTIVE',null),/evidence/);assert.equal((await advance('ACTIVE')).status,'ACTIVE');
  await assert.rejects(advance('DEFAULT_NOTICE'),/cure deadline/);
  await advance('DEFAULT_NOTICE',DOC,'2099-01-01');await assert.rejects(advance('ENFORCEMENT_REVIEW'),/not expired/);
  assert.equal((await advance('DISPUTED',null,null,MEMBER)).status,'DISPUTED');await assert.rejects(advance('ENFORCEMENT_REVIEW'),/not authorized/);
  await advance('ACTIVE');await advance('RELEASED');assert.deepEqual(await row('select vice_units,v4x_units from public.holders where id=$1',[MEMBER]),before);
  assert.equal(Number((await row("select vice_private.lending_encumbered($1,'VICE','STRATEGIC') n",[MEMBER])).n),0);
 });
 await check('Empty duplicate closure preserves linked valid member and journal',async()=>{
  const duplicate=id(222);await db.query("insert into public.holders(id,name,email,client_id,vice_units,v4x_units) values($1,'Synthetic duplicate','member3@example.test','VC-TEST-DUP',0,0)",[duplicate]);
  await assert.rejects(rpc(ROOT,'vice_close_erroneous_holder',[MEMBER,reason,randomUUID()]),/Reconcile/);
  await assert.rejects(rpc(CFO,'vice_close_erroneous_holder',[duplicate,reason,randomUUID()]),/administrator/);
  const result=await rpc(ROOT,'vice_close_erroneous_holder',[duplicate,reason,randomUUID()]);assert.equal(result.closed,true);
  const closed=await row('select * from public.holders where id=$1',[duplicate]);assert.equal(closed.email,null);assert.equal(closed.status,'CLOSED');
  assert.equal((await rpc(MEMBER,'vice_member_access_status',[])).allowed,true);
  assert.equal((await row('select event_type from public.iru_events where seq=$1',[result.seq])).event_type,'HOLDER_CLOSED');
 });
 await check('Personal bot denies CFO and other root administrators; only KAHZI can enable it',async()=>{
  assert.equal((await rpc(CFO,'vice_personal_bot_access',[])).allowed,false);
  await assert.rejects(rpc(ROOT,'vice_set_personal_bot_enabled',[true]),/restricted to KAHZI/);
  await assert.rejects(rpc(CFO,'vice_set_personal_bot_enabled',[true]),/restricted to KAHZI/);
  const kahzi='6e83b6bc-e247-41fc-8469-4267987273b7';sessions.set(kahzi,randomUUID());
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-founder@example.test',now())",[kahzi]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[sessions.get(kahzi),kahzi]);
  await db.query("insert into public.profiles(id,name,email,role) values($1,'Synthetic founder','synthetic-founder@example.test','SUPER_ADMIN')",[kahzi]);
  const before=await rpc(kahzi,'vice_personal_bot_access',[]);assert.equal(before.allowed,true);assert.equal(before.enabled,false);
  const enabled=await rpc(kahzi,'vice_set_personal_bot_enabled',[true]);assert.equal(enabled.enabled,true);assert.equal(enabled.broker_execution,false);
  assert.equal((await rpc(kahzi,'vice_set_personal_bot_enabled',[false])).enabled,false);
 });
 console.log(JSON.stringify({suite:'registry-controls-postgresql',passed,failed:0,skipped:0}));
}catch(e){console.error('FAIL after '+passed+' checks:',e.message,e.where||'');process.exitCode=1;}
finally{await db.close();}
