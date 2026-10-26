// VICE OS Phase 3.23: compose authenticated SOC ingress with server-only
// PostgreSQL adapters. Supply a restricted server-side db client; never ship
// database credentials or the HMAC secret to browser code.
import {createSocIngress} from './ingress.mjs';
import {makePgNonceConsumer} from './pg-nonce-store.mjs';
import {makePgIncidentWriter} from './pg-incident-writer.mjs';

export function createPgSocIngress({db,secret,clock=Date.now}={}){
  if(!db||typeof db.query!=='function')throw new TypeError('Trusted PostgreSQL client required');
  return createSocIngress({
    secret,
    clock,
    consumeNonce:makePgNonceConsumer(db),
    writeIncidents:makePgIncidentWriter(db)
  });
}
