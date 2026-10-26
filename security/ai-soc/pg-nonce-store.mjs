// Phase 3.15: PostgreSQL nonce consumer for a trusted server using a scoped
// database client with parameterized query support. Not browser-safe.
export function makePgNonceConsumer(db){
  if(!db || typeof db.query!=='function')throw new TypeError('Database query adapter required');
  return async function consumeNonce(nonce,timestamp){
    if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(nonce))return false;
    if(typeof timestamp!=='string'||!/^[0-9]{13}$/.test(timestamp))return false;
    const issued=Number(timestamp);
    if(!Number.isSafeInteger(issued))return false;
    // The HMAC verifier must validate the timestamp first. Database time is
    // authoritative for storage. Expiry is 11 minutes after issuance.
    const result=await db.query(
      'INSERT INTO public.vice_soc_webhook_nonces (nonce,issued_at,expires_at) VALUES ($1,to_timestamp($2::double precision/1000.0),to_timestamp($2::double precision/1000.0)+interval \'11 minutes\') ON CONFLICT (nonce) DO NOTHING RETURNING nonce',
      [nonce,issued]
    );
    return result?.rowCount===1;
  };
}
