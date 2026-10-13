'use strict';
/** VICE OS 1.3.6.10 source-only security contracts. No production credentials. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const code=read('index.html'),manifest=JSON.parse(read('version.json'));
const m=read('supabase/migrations/20261013040147_vice_1370_channel_acl_and_chat_identity_integrity.sql');
assert.equal(manifest.version,'1.3.6.10-AUDIT-PROVENANCE');
assert(code.includes('badge:\'RLS\''),'Security label must not imply audited E2EE');
assert(code.includes('Legacy message encryption uses publicly derivable thread keys'),'Crypto limitations must be disclosed');
for(const s of [
'CREATE POLICY vice_read ON public.messages',
'CREATE POLICY vice_insert ON public.messages',
"channel_id IN ('reserve','treasury')",
"channel_id IN ('general','trading')",
'CREATE OR REPLACE FUNCTION public.vice_message_identity_guard()',
'NEW.sender_name :=',
'BEFORE INSERT ON public.dm_messages',
'EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=peer_id)',
'REVOKE ALL ON FUNCTION public.vice_message_identity_guard() FROM PUBLIC,anon,authenticated'
])assert(m.includes(s),'Missing enforced RLS / identity guard: '+s);
assert(!/\ballow all\b/i.test(m),'Never permit all chats');
const rpc=read('supabase/migrations/20261013034008_vice_1369_complete_role_price_and_operational_health_rpcs.sql');
for(const x of ['public.vice_assign_member_role','public.vice_set_dao_prices','public.vice_operational_health'])
 assert(rpc.includes(x),'Critical backend RPC missing '+x);
const schema=read('supabase/migrations/20261013025843_vice_1366_high_priority_row_security_hardening.sql');
assert(schema.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles'),'Direct role self escalation must remain blocked');

assert(code.includes('function viceCommsBubble(value)'),'Rich message renderer must exist');
assert(code.includes("const VICE_MEDIA_PREFIX='VICE_MEDIA_V1:'"),'Media envelope support missing');
assert(code.includes("if(act==='vice-attach')"),'Attach control must have an event handler');
assert(code.includes("if(act==='vice-voice')"),'Voice control must have an event handler');
assert(code.includes('function viceToggleVoiceRecording()'),'Voice recording implementation missing');
assert(code.includes('void viceHydrateChatMedia(el)'),'Media player signed URLs not hydrated');
assert(code.includes('viceAbortVoiceRecording();'),'Logout must halt microphone recording');
const media=read('supabase/migrations/20261013040801_vice_1371_private_chat_media_bucket_storage_acl.sql');
assert(media.includes("VALUES ('vice-chat-media','vice-chat-media',false"),'Chat-media storage must be private');
assert(media.includes('CREATE POLICY vice_chat_media_upload'),'Private uploads need RLS');
assert(media.includes('CREATE POLICY vice_chat_media_read'),'Member-scoped signed URL reads need RLS');
const dmPath=read('supabase/migrations/20261013041046_vice_1372_dm_media_storage_correlated_acl_fix.sql');
assert(dmPath.includes('storage.foldername(storage.objects.name)'), 'RLS DM correlated reference must use storage.objects.name');
const realtime=read('supabase/migrations/20261013041130_vice_1373_realtime_direct_message_replication.sql');
assert(realtime.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages'),'Live DM postgres_changes replication missing');


assert(code.includes("channelDb=sb.channel('vice-os-rbac-channel-inbox-'"),'Channel realtime must subscribe through RLS');
assert(code.includes("table:'messages'"),'RLS channel INSERT subscription missing');
assert(!code.includes("event:'chat',payload"),'Global broadcast must not carry chat message content');
assert(!code.includes("event:'chat' }, ({ payload })"),'Global chat event listener can bypass staff-channel RLS');
const channelStream=read('supabase/migrations/20261013041304_vice_1374_authorized_channel_postgres_realtime.sql');
assert(channelStream.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.messages'),
 'Channel changes must publish through RLS-protected postgres_changes');


const inviteGate=read('supabase/migrations/20261013041502_vice_1375_invite_only_chat_media_membership_acl.sql');
assert(inviteGate.includes('public.profiles pr WHERE pr.id=(SELECT auth.uid())'),
 'Uninvited auth identities cannot read chat');
assert(inviteGate.includes('ALTER POLICY %I ON storage.objects'),
 'Media access must be additionally restricted to provisioned members');
const vipGate=read('supabase/migrations/20261013041544_vice_1376_vip_channel_membership_acl.sql');
assert(vipGate.includes('pr.vip_access IS TRUE'),'Non-VIP accounts must not read VIP messages');

const auditMigration=read('supabase/migrations/20261013044725_vice_1377_trusted_audit_and_provisioned_dm.sql');
assert(auditMigration.includes('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.audit_log'),'Direct trusted ledger write remains prohibited');
assert(auditMigration.includes('CLIENT_REPORTED') && auditMigration.includes('UNVERIFIED_CLIENT_EVENT'),'Client events must be distinguishable from issuer-authorized operations');
assert(auditMigration.includes('CREATE POLICY vice_read ON public.dm_messages'),'DM RLS must require member profile');
assert(code.includes("sb.rpc('vice_record_client_activity'"),'Client activity must route through rate-limited RPC');
assert(!code.includes("sb.from('audit_log').insert("),'Browser may not forge authoritative audit entry');
const turn=read('netlify/functions/turn-credentials.mjs');
assert(turn.includes("+'/rest/v1/profiles'")&&turn.includes("return json(403,{error:'Approved VICE membership required'});"),'TURN credentials require provisioned membership');
const docsGate=read('supabase/migrations/20261013045400_vice_1378_provisioned_signatures_directory_academy.sql');
for(const marker of ['public.sign_document','public.list_member_directory','public.submit_academy_quiz','Provisioned member identity required','public.is_super()'])
  assert(docsGate.includes(marker),'Missing issuer/document/membership ACL: '+marker);
console.log('PASS',manifest.version,'— backend RBAC, private media, signed playback, recorder controls and realtime DMs.');
