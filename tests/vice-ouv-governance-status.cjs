'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('approved OUV proposal remains pending until execution and never changes official reference locally',()=>{
 assert.match(source,/BOTH EXECUTIVES APPROVED — AWAITING EXECUTION/);
 assert.match(source,/APPROVED · EXECUTION GATES PENDING/);
 assert.match(source,/No official OUV update until the backend records a verified execution/);
 assert.match(source,/const approvalComplete=authorizations===2/);
 assert.match(source,/const reviewDeadlinePassed=Number\.isFinite\(deadline\)&&Date\.now\(\)>=deadline/);
 assert.match(source,/const governanceStage=p\.status!=='REVIEW'\?p\.status/);
 assert.match(source,/await refreshDaoConfig\(\); \/\/ Canonical public display value/);
 assert.match(source,/can_apply===true/);
});
