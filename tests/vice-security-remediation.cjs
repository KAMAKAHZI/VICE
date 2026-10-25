'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const html=fs.readFileSync('index.html','utf8');
const workflow=fs.readFileSync('.github/workflows/vice-continuous-defensive-security.yml','utf8');
const sql=fs.readFileSync('sql/security_disable_public_username_lookup_candidate.sql','utf8');
const cert=fs.readFileSync('sql/security_certificate_public_minimization_candidate.sql','utf8');

test('browser never calls anonymous username-to-email RPC',()=>{
  assert.doesNotMatch(html,/sb\.rpc\(['"]lookup_email_for_login['"]/);
  assert.match(html,/signInWithPassword\(\{ email, password: pw \}\)/);
});
test('legacy username login displays email-only migration guidance',()=>{
  assert.match(html,/sign in using your registered email address/i);
});
test('lookup revocation explicitly removes public and anon access',()=>{
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.lookup_email_for_login\(text\) FROM PUBLIC;/);
  assert.match(sql,/FROM anon;/);
});
test('public certificate validation can inspect a digest but never returns private fields',()=>{
  // Digest verification must read private stored fields; public RETURN data must
  // not include them. The disposable PostgreSQL suite checks actual JSON output.
  const success=cert.match(/RETURN jsonb_build_object\('valid',true,[\s\S]*?\);/);
  assert(success,'Public success response must be explicitly defined');
  assert.doesNotMatch(success[0],/'(?:scores|overall_score|digest|salt|revoked_reason|holder_email|profile_id)'/);
  assert.match(cert,/rec\.digest IS DISTINCT FROM expected_digest/);
  assert.match(cert,/INTEGRITY_FAILURE/);
  assert.match(cert,/SET search_path TO ''/);
});
test('expired certificates must be rejected before public verification succeeds',()=>{
  assert.match(cert,/rec\.expires_at IS NOT NULL AND rec\.expires_at <= now\(\)/);
  assert.match(cert,/jsonb_build_object\('valid',false,'reason','EXPIRED'\)/);
});
test('defensive workflow pins every external GitHub action',()=>{
  for(const line of workflow.split('\n')){
    const m=line.match(/^\s*-?\s*uses:\s*[^@]+@([^\s#]+)/);
    if(m)assert.match(m[1],/^[0-9a-f]{40}$/);
  }
});
test('continuous defense runs on pull requests and a daily schedule',()=>{
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/schedule:/);
});
