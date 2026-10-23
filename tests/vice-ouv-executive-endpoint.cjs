'use strict';
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/ouv-final-deploy.js');
(async()=>{
 let r=await handler({httpMethod:'GET',headers:{},body:''});
 assert.equal(r.statusCode,405);
 r=await handler({httpMethod:'POST',headers:{},body:'{}'});
 assert.equal(r.statusCode,401);
 r=await handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:'not json'});
 assert.equal(r.statusCode,400);
 r=await handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({action:'execute_ouv',proposal_id:'PROP-20261019-548A9057-34F'})});
 assert.equal(r.statusCode,400);
 r=await handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({action:'activate_auto',proposal_id:'PROP-20261019-548A9057-34F'})});
 assert.equal(r.statusCode,400);
 for(const key of ['status','management_reference_only','holder_units_changed'])assert.ok(Object.hasOwn(JSON.parse(r.body),key));
 console.log('PASS: governance endpoint rejects unauthorized and invalid actions');
})().catch(e=>{console.error(e);process.exitCode=1});
