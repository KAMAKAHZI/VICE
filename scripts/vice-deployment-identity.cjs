'use strict';
const fs=require('node:fs');
function identity(env,version,now=new Date()){
 const commit=env.COMMIT_REF||env.GITHUB_SHA||'';
 const deploy=env.DEPLOY_ID||'';
 return {release_version:version,commit:/^[a-f0-9]{40}$/i.test(commit)?commit:null,deployment_id:/^[a-z0-9-]{12,80}$/i.test(deploy)?deploy:null,context:['production','deploy-preview','branch-deploy','dev'].includes(env.CONTEXT)?env.CONTEXT:'local',built_at:now.toISOString()};
}
module.exports={identity};
if(require.main===module){const version=JSON.parse(fs.readFileSync('version.json','utf8')).version;fs.writeFileSync('dist/site/deployment.json',JSON.stringify(identity(process.env,version),null,2)+'\n');}
