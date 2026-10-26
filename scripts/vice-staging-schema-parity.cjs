'use strict';
/* VICE OS — read-only structural staging parity gate.
 * Input: two schema-only JSON exports from Supabase list_tables(verbose=true).
 * No database connections, production keys, row values, or mutations.
 * A passing table check is NOT a full governance/security release approval. */
const fs=require('node:fs');

function normalize(input,label){
  const data=typeof input?.text==='string'?JSON.parse(input.text):input;
  const rows=Array.isArray(data)?data:(data?.tables||data?.result?.tables);
  if(!Array.isArray(rows))throw Error(label+': expected table metadata JSON');
  const out=new Map();
  for(const t of rows){
    if(typeof t?.name!=='string'||!/^public\.[a-zA-Z_][a-zA-Z_0-9]*$/.test(t.name)
       || !Array.isArray(t.columns) || typeof t.rls_enabled!=='boolean')
      throw Error(label+': invalid schema-only table descriptor');
    if(out.has(t.name))throw Error(label+': duplicate table descriptor');
    const columns=new Map();
    for(const c of t.columns){
      if(typeof c?.name!=='string'||typeof c?.data_type!=='string')
        throw Error(label+': invalid column descriptor');
      if(columns.has(c.name))throw Error(label+': duplicate column descriptor');
      columns.set(c.name,c.format||c.data_type);
    }
    out.set(t.name,{rls_enabled:t.rls_enabled,columns});
  }
  return out;
}
function analyze(production,staging){
  const a=normalize(production,'production'),b=normalize(staging,'staging');
  if(!a.size)throw Error('Production baseline is empty; refusing false readiness');
  const missingTables=[],missingColumns=[],typeMismatches=[],rlsMismatches=[],
    stagingOnlyTables=[],stagingOnlyColumns=[];
  for(const [name,table] of a){
    const other=b.get(name);
    if(!other){missingTables.push(name);continue;}
    if(table.rls_enabled&&!other.rls_enabled)rlsMismatches.push(name);
    for(const [column,format] of table.columns){
      if(!other.columns.has(column))missingColumns.push(name+'.'+column);
      else if(other.columns.get(column)!==format)
        typeMismatches.push({table:name,column,productionFormat:format,stagingFormat:other.columns.get(column)});
    }
    for(const column of other.columns.keys()){
      if(!table.columns.has(column))stagingOnlyColumns.push(name+'.'+column);
    }
  }
  for(const name of b.keys())if(!a.has(name))stagingOnlyTables.push(name);
  for(const arr of [missingTables,missingColumns,rlsMismatches,stagingOnlyTables,stagingOnlyColumns])arr.sort();
  const schemaTablesReady=missingTables.length===0&&missingColumns.length===0&&
    typeMismatches.length===0&&rlsMismatches.length===0;
  return {
    baseline:'read-only public table/column/RLS metadata',
    productionTableCount:a.size,stagingTableCount:b.size,
    sharedTableCount:a.size-missingTables.length,
    schemaTablesReady,
    blockers:{missingTables,missingColumns,typeMismatches,rlsMismatches},
    reviewItems:{stagingOnlyTables,stagingOnlyColumns},
    requiresIndependentVerification:[
      'production-equivalent SQL functions, triggers, policies, and EXECUTE grants',
      'migration order and ownership',
      'synthetic user-role and API contract tests',
      'legacy certificate signature/digest compatibility',
      'backup/restore and rollback evidence',
      'executive governance approvals and release sign-off'
    ],
    productionDeploymentAuthorized:false
  };
}
if(require.main===module){
  try{
    if(process.argv.length!==4)throw Error('Usage: node scripts/vice-staging-schema-parity.cjs production-metadata.json staging-metadata.json');
    const result=analyze(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),
      JSON.parse(fs.readFileSync(process.argv[3],'utf8')));
    console.log(JSON.stringify(result,null,2));
    if(!result.schemaTablesReady)process.exitCode=2;
  }catch(e){console.error('Schema parity check failed: '+e.message);process.exitCode=1;}
}
module.exports={analyze};
