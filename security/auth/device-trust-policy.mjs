export const DEVICE_TRUST_MAX_AGE_MS = 86400000;

// Policy decision only. Never use without backend-verified passkey evidence.
export function evaluateDeviceTrust({now, verifiedAt, expiresAt, revoked, passkeyVerified, privileged, actionProofVerified}) {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(verifiedAt) || !Number.isSafeInteger(expiresAt)) return 'mfa_required';
  if (revoked || verifiedAt > now || expiresAt <= now || expiresAt > verifiedAt + DEVICE_TRUST_MAX_AGE_MS) return 'mfa_required';
  if (passkeyVerified !== true) return 'passkey_required';
  if (privileged === true && actionProofVerified !== true) return 'action_proof_required';
  return 'allowed';
}
