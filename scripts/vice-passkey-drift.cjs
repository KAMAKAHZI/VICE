'use strict';
/**
 * Read-only Supabase Edge Function deployment drift guard.
 * A mismatch is a BLOCKER; never report PASS when token/metadata is missing.
 * Requires a read-only Management API token with edge_functions_read.
 */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const BASELINE_PATH=path.join(ROOT,'docs/audit/passkey-deployment-baseline.json');
const BASELINE=JSON.parse(fs.readFileSync(BASELINE_PATH,'utf8'));
function gitBlobSha(content){
 const bytes=Buffer.isBuffer(content)?content:Buffer.from(content);
 return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
async function checkDrift({token=process.env.SUPABASE_ACCESS_TOKEN,fetcher=globalThis.fetch,readFile=fs.readFileSync}={}){
 if(!token || !token.trim())throw Error('BLOCKED: SUPABASE_ACCESS_TOKEN is missing. Cannot check deployed source identity.');
 if(!/^[a-z0-9]{20}$/.test(BASELINE.project_ref))throw Error('Invalid project ref in baseline');
 if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(BASELINE.function_slug))throw Error('Invalid function slug in baseline');
 const sourcePath=path.join(ROOT,'supabase/functions',BASELINE.function_slug,'index.ts');
 const source=readFile(sourcePath);
 const actualSourceSha=gitBlobSha(source);
 if(actualSourceSha!==BASELINE.source_git_blob_sha)throw Error('DRIFT: committed passkey source differs from approved git-blob baseline');
 const url='https://api.supabase.com/v1/projects/'+BASELINE.project_ref+'/functions';
 let res;
 try{
  res=await fetcher(url,{
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(15000),
   redirect:'error'
  });
 }catch(e){throw Error('BLOCKED: unable to retrieve deployed function metadata ('+(e.name==='TimeoutError'?'timeout':'network error')+')')}
 if(!res.ok)throw Error('BLOCKED: Supabase Management API responded HTTP '+res.status);
 let list;
 try{list=await res.json()}catch{throw Error('BLOCKED: invalid Management API response')}
 if(!Array.isArray(list))throw Error('BLOCKED: Management API returned unexpected function list format');
 const candidates=list.filter(item=>item?.slug===BASELINE.function_slug);
 if(candidates.length!==1)throw Error('DRIFT: expected exactly one deployed '+BASELINE.function_slug+' function');
 const deployed=candidates[0];
 const fields=['version','status','verify_jwt','ezbr_sha256'];
 const mismatches=fields.filter(field=>deployed[field]!==BASELINE[field]);
 if(mismatches.length)throw Error('DRIFT: deployed passkey differs from approved baseline: '+mismatches.join(', '));
 if(BASELINE.verify_jwt!==true || BASELINE.status!=='ACTIVE')throw Error('BLOCKED: unapproved baseline security configuration');
 return {slug:BASELINE.function_slug,version:deployed.version,source_git_blob_sha:actualSourceSha,ezbr_sha256:deployed.ezbr_sha256,verify_jwt:deployed.verify_jwt,status:deployed.status};
}
if(require.main===module)checkDrift().then(v=>{
 console.log('PASS: '+v.slug+' source baseline and live bundle metadata match; WebAuthn still DISABLED');
}).catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={checkDrift,gitBlobSha,BASELINE};
