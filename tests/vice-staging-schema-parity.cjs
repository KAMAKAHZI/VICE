'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../scripts/vice-staging-schema-parity.cjs');
const t=(name,rls_enabled,columns)=>({name,rls_enabled,columns:Object.entries(columns).map(([n,format])=>({name:n,data_type:format,format}))});
const prod={tables:[
 t('public.certificates',true,{cert_id:'text',profile_id:'uuid',salt:'text',digest:'text',scores:'jsonb'}),
 t('public.vice_ouv_execution_receipts',true,{id:'uuid',proposal_id:'text'}),
 t('public.email_outbox',true,{id:'uuid',status:'text'})
]};
const staged={tables:[
 t('public.certificates',true,{cert_id:'text',digest:'text',scores:'jsonb'}),
 t('public.email_outbox',true,{id:'uuid',status:'text',lease_until:'timestamptz'})
]};
test('realistic isolated staging fixture fails closed on missing tables and digest prerequisites',()=>{
 const r=analyze(prod,staged);
 assert.equal(r.schemaTablesReady,false);
 assert.equal(r.productionDeploymentAuthorized,false);
 assert.deepEqual(r.blockers.missingTables,['public.vice_ouv_execution_receipts']);
 assert.deepEqual(r.blockers.missingColumns,['public.certificates.profile_id','public.certificates.salt']);
 assert.deepEqual(r.reviewItems.stagingOnlyColumns,['public.email_outbox.lease_until']);
});
test('matching table and column metadata passes only the structural table gate',()=>{
 const r=analyze(prod,JSON.parse(JSON.stringify(prod)));
 assert.equal(r.schemaTablesReady,true);
 assert.equal(r.productionDeploymentAuthorized,false);
 assert(r.requiresIndependentVerification.some(v=>/EXECUTE grants/.test(v)));
});
test('RLS-off and conflicting column type block parity',()=>{
 const changed=JSON.parse(JSON.stringify(prod));
 changed.tables[0].rls_enabled=false;
 changed.tables[1].columns.find(c=>c.name==='proposal_id').format='uuid';
 const r=analyze(prod,changed);
 assert.equal(r.schemaTablesReady,false);
 assert.deepEqual(r.blockers.rlsMismatches,['public.certificates']);
 assert.equal(r.blockers.typeMismatches[0].column,'proposal_id');
});
test('empty production baseline and invalid descriptor cannot pass',()=>{
 assert.throws(()=>analyze({tables:[]},staged),/baseline is empty/);
 assert.throws(()=>analyze({tables:[{name:'public.x',columns:[],rls_enabled:'yes'}]},staged),/invalid schema-only/);
});
test('supports wrapped connector text and does not include any row data in its output',()=>{
 const wrapped={text:JSON.stringify({tables:prod.tables,private_records:[{password:'must-not-be-emitted'}]})};
 const r=analyze(wrapped,wrapped);
 assert.equal(r.schemaTablesReady,true);
 assert(!JSON.stringify(r).includes('must-not-be-emitted'));
});
