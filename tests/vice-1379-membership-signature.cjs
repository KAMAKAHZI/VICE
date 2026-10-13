'use strict';
/** Security contract guard for installed SQL. Static checks supplement,
 * and do not replace, the live database transaction rollback tests. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const sql=fs.readFileSync('supabase/migrations/20261013045325_vice_1378_signer_membership_and_directory_hardening.sql','utf8');
const audit=fs.readFileSync('supabase/migrations/20261013044725_vice_1377_trusted_audit_and_provisioned_dm.sql','utf8');
const turn=fs.readFileSync('netlify/functions/turn-credentials.mjs','utf8');
const meta=JSON.parse(fs.readFileSync('version.json','utf8'));
assert.equal(meta.version,'1.3.8.0-IRU-CERTIFICATES');
assert(source.includes(meta.version),'Source release marker must match manifest');
for(const [needle,msg] of [
 ['CREATE OR REPLACE FUNCTION public.list_member_directory()', 'Directory RPC missing'],
 ['SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid())','Directory must require invited VICE profile'],
 ['CREATE OR REPLACE FUNCTION public.submit_academy_quiz','Quiz RPC missing'],
 ["RAISE EXCEPTION 'Provisioned VICE membership required'",'Uninvited quiz member guard missing'],
 ['CREATE OR REPLACE FUNCTION public.sign_document','Signing RPC missing'],
 ['SELECT * INTO p FROM public.profiles WHERE id=v_uid','Signing must resolve provisioned identity'],
 ['Document is not assigned to this signer','Non-owner signature must be rejected'],
 ['d.holder_client_id IS NOT NULL','Client-bound signing must be explicit'],
 ['d.holder_id IS NOT NULL','Holder-bound signing must be explicit'],
 ['d.uploaded_by=v_uid::text','Unassigned internal document signing requires owner'],
 ['lower(trim(p_typed_name)) IS DISTINCT FROM lower(trim(p.name))','Typed names must match known member'],
 ['d.sha256 !~','Signed document must have validated file digest'],
 ['WHERE id=d.id','Update only the checked locked document'],
])assert(sql.includes(needle),msg);
for(const [needle,msg] of [
 ['REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.audit_log','Browser audit spoofing must be prevented'],
 ['CREATE OR REPLACE FUNCTION public.vice_record_client_activity','Bounded server-only client activity missing'],
 ['UNVERIFIED_CLIENT_EVENT','Unverified client activity cannot claim server success'],
 ['CREATE POLICY vice_read ON public.dm_messages','DM reads must be re-scoped'],
 ['CREATE POLICY vice_insert ON public.dm_messages','DM inserts must be re-scoped']
])assert(audit.includes(needle),msg);
assert(source.includes("sb.rpc('vice_record_client_activity'"),'Browser must use RPC, not direct privileged audit inserts');
assert(!source.includes("sb.from('audit_log').insert("),'Direct client audit insert reintroduced');
assert(turn.includes("'Approved VICE membership required'"),'Uninvited users must not receive TURN creds');
assert(turn.includes("'/rest/v1/profiles'"),'TURN approval check must use JWT-scoped profiles');
console.log('PASS: inviter identity, directory, quiz, signer, telemetry, DM and TURN regression gates');
