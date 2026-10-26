'use strict';
// Read-only governance evidence verifier. NEVER grants execution authorization.
// Node.js 20+ built-in crypto, no third-party dependency.
const { createHash, timingSafeEqual, verify, createPublicKey } = require('node:crypto');
function fail(reason) { return { verified: false, reason }; }
function digest(payload) { return createHash('sha256').update(payload).digest('hex'); }
function checkEvidence(input) {
  if (!input || typeof input !== 'object') return fail('INVALID_INPUT');
  const { proposalId, canonicalPayload, expectedPayloadHash, signatures, requiredSignerIds, threshold } = input;
  if (typeof proposalId !== 'string' || !proposalId || typeof canonicalPayload !== 'string') return fail('INVALID_PROPOSAL');
  if (typeof expectedPayloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedPayloadHash)) return fail('INVALID_HASH');
  if (!Array.isArray(signatures) || !Array.isArray(requiredSignerIds) || !Number.isSafeInteger(threshold) || threshold < 1 || threshold > requiredSignerIds.length) return fail('INVALID_POLICY');
  const calculated = digest(canonicalPayload);
  if (!timingSafeEqual(Buffer.from(calculated,'hex'), Buffer.from(expectedPayloadHash,'hex'))) return fail('PAYLOAD_HASH_MISMATCH');
  const allowed = new Set(requiredSignerIds);
  if (allowed.size !== requiredSignerIds.length || [...allowed].some(x=>typeof x !== 'string' || !x)) return fail('INVALID_SIGNER_POLICY');
  const signed = new Set();
  // Bind signature to exact proposal ID and canonical payload hash.
  const message = Buffer.from('VICE-OUV-GOVERNANCE-V1\n'+proposalId+'\n'+expectedPayloadHash,'utf8');
  for (const s of signatures) {
    if (!s || !allowed.has(s.signerId) || signed.has(s.signerId)) return fail('UNAUTHORIZED_OR_DUPLICATE_SIGNER');
    if (s.algorithm !== 'Ed25519' || typeof s.publicKeyPem !== 'string' || typeof s.signatureBase64 !== 'string') return fail('INVALID_SIGNATURE_FORMAT');
    // This key must be matched to an independently maintained, approved signer registry.
    if (!input.trustedPublicKeys || input.trustedPublicKeys[s.signerId] !== s.publicKeyPem) return fail('UNTRUSTED_SIGNER_KEY');
    try {
      const key = createPublicKey(s.publicKeyPem);
      if (key.asymmetricKeyType !== 'ed25519' || !verify(null,message,key,Buffer.from(s.signatureBase64,'base64'))) return fail('BAD_SIGNATURE');
    } catch { return fail('BAD_SIGNATURE'); }
    signed.add(s.signerId);
  }
  if (signed.size < threshold) return fail('QUORUM_NOT_MET');
  return { verified: true, signerCount: signed.size, proposalId, payloadHash: expectedPayloadHash };
}
module.exports = { checkEvidence, digest };
