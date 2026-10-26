/* Production-shaped, schema-only Academy verifier regression.
 * Uses the existing isolated registry baseline in PGlite, never Supabase data. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const db=new PGlite({extensions:{pgcrypto}});
const uid='00000000-0000-4000-8000-000000000001';
const name='Synthetic Academy Learner';
const title='VICE4X Sovereign Trading & Wealth Architecture — Core Program (Modules I–VII)';
const scores={I:83,II:94};
const salt='synthetic-internal-digest-salt';
const id=n=>'VCA-1111-2222-3333-'+String(n).padStart(4,'0');
const execute=async(query,args=[])=>db.query(query,args);
async function seed(n,{tampered=false,revoked=false,expired=false}={}){
  const cert=id(n);
  const data=JSON.stringify(scores);
  // Postgres canonical jsonb::text is part of the actual issuer digest formula.
  const scoresText=(await execute('SELECT $1::jsonb::text AS value',[data])).rows[0].value;
  const material=[uid,cert,name,title,scoresText,'89',salt].join('|');
  const digest=(await execute("SELECT encode(sha256(convert_to($1,'UTF8')),'hex') AS value",[material])).rows[0].value;
  await execute(`INSERT INTO public.certificates
    (cert_id,profile_id,holder_name,holder_email,course_title,scores,overall_score,digest,salt,revoked,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[
      cert,uid,name,'private@example.invalid',title,data,89,tampered?'deliberate-invalid-hash':digest,
      salt,revoked,expired?'2000-01-01T00:00:00Z':null
    ]);
  return cert;
}
async function checkAsAnon(cert){
  await db.exec('BEGIN; SET LOCAL ROLE anon');
  try{
    const result=(await execute('SELECT public.verify_certificate($1) AS certificate',[cert])).rows[0].certificate;
    await db.exec('COMMIT');
    return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
try{
  await db.exec(fs.readFileSync('tests/sql/vice-registry-baseline.sql','utf8'));
  await db.exec(fs.readFileSync('sql/security_certificate_public_minimization_candidate.sql','utf8'));
  assert.equal((await execute("SELECT has_function_privilege('anon','public.verify_certificate(text)','EXECUTE') AS yes")).rows[0].yes,true);
  await execute('INSERT INTO auth.users(id,email) VALUES ($1,$2)',[uid,'private@example.invalid']);
  await execute('INSERT INTO public.profiles(id,name,email,role) VALUES ($1,$2,$3,$4)',[uid,name,'private@example.invalid','HOLDER']);

  const valid=await checkAsAnon(await seed(1));
  assert.equal(valid.valid,true,'Valid issuer-produced award rejected');
  assert.equal(valid.name,name);
  assert.equal(valid.course,title);
  for(const field of ['scores','overall_score','digest','salt','holder_email','profile_id','revoked_reason']){
    assert.equal(Object.hasOwn(valid,field),false,'Private field disclosed: '+field);
  }
  assert(!JSON.stringify(valid).includes('private@example.invalid'));
  assert(!JSON.stringify(valid).includes(salt));

  const tampered=await checkAsAnon(await seed(2,{tampered:true}));
  assert.equal(tampered.valid,false);
  assert.equal(tampered.reason,'INTEGRITY_FAILURE');
  const expired=await checkAsAnon(await seed(3,{expired:true}));
  assert.equal(expired.reason,'EXPIRED');
  const revoked=await checkAsAnon(await seed(4,{revoked:true}));
  assert.equal(revoked.reason,'REVOKED');
  assert(!Object.hasOwn(revoked,'revoked_reason'));
  assert.equal((await checkAsAnon('VCA-1111-2222-3333-FFFF')).reason,'NOT_FOUND');
  assert.equal((await checkAsAnon(' ')).reason,'INVALID_ID');
  console.log('PASS production-shaped public Academy verifier: stored digest, denied tampering, expiry, revocation and field minimization');
}finally{await db.close();}
