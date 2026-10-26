// VICE OS Phase 3.14 — authenticated inbound SOC webhook verification.
// Server-side only. Never bundle this module or its secret into the browser.
// The ingress endpoint must enforce TLS, body size limits, rate limits,
// and a durable nonce-uniqueness constraint before accepting an event.
import {createHmac, timingSafeEqual} from 'node:crypto';
const MAX_SKEW_MS=5*60*1000;
export function verifySocWebhook({rawBody,timestamp,nonce,signature,secret,now=Date.now()}){
  if(typeof rawBody!=='string'||Buffer.byteLength(rawBody)>65536) return false;
  if(typeof timestamp!=='string'||!/^[0-9]{13}$/.test(timestamp))return false;
  if(typeof nonce!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(nonce))return false;
  if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  if(typeof secret!=='string'||Buffer.byteLength(secret)<32)return false;
  const issued=Number(timestamp);
  if(!Number.isSafeInteger(issued)||!Number.isFinite(now)||Math.abs(now-issued)>MAX_SKEW_MS)return false;
  const signed=timestamp+'.'+nonce+'.'+rawBody;
  const expected=createHmac('sha256',secret).update(signed,'utf8').digest();
  const supplied=Buffer.from(signature.slice(7),'hex');
  return supplied.length===expected.length&&timingSafeEqual(expected,supplied);
}
export async function authenticateSocWebhook(payload,consumeNonce){
  if(typeof consumeNonce!=='function')throw new TypeError('Durable nonce consumer required');
  if(!verifySocWebhook(payload))throw new Error('Webhook authentication failed');
  // consumeNonce must atomically INSERT nonce into persistent UNIQUE store,
  // return true exactly once and fail closed on storage outage.
  if(await consumeNonce(payload.nonce,payload.timestamp)!==true)
    throw new Error('Replay detected or nonce store unavailable');
  return Object.freeze({trustedSource:true,serverAuthenticated:true});
}
