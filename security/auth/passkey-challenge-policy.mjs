// Trusted challenge record checks, independent of transport or database.
export const PASSKEY_CHALLENGE_TTL_MS=300000;
export function validatePasskeyChallenge({record,actorId,now,action,payloadHash}={}){
 if(!record||typeof record!=='object'||typeof actorId!=='string'||!actorId||!Number.isSafeInteger(now)||now<0)return false;
 if(record.actorId!==actorId||record.used===true||!Number.isSafeInteger(record.createdAt)||!Number.isSafeInteger(record.expiresAt))return false;
 if(record.createdAt<0||record.createdAt>now||record.expiresAt<=now||record.expiresAt<=record.createdAt||record.expiresAt>record.createdAt+PASSKEY_CHALLENGE_TTL_MS)return false;
 if(action!==undefined&&(typeof action!=='string'||record.action!==action))return false;
 if(payloadHash!==undefined&&(typeof payloadHash!=='string'||record.payloadHash!==payloadHash))return false;
 return true;
}
