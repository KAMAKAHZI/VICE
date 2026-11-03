// PostgreSQL server-only challenge adapter. Use a dedicated backend DB role,
// never browser credentials. Schema: vice_private.passkey_auth_challenges
// (id uuid, actor_id uuid, challenge text, created_at timestamptz,
// expires_at timestamptz, used_at timestamptz, action text, payload_hash text).
export function makePgPasskeyChallengeStore({query}={}){
 if(typeof query!=='function')throw new TypeError('Database query required');
 return {
  async loadChallenge(id){
   const r=await query('SELECT actor_id, challenge, created_at, expires_at, used_at, action, payload_hash FROM vice_private.passkey_auth_challenges WHERE id=$1',[id]);
   const x=r.rows?.[0];
   if(!x)return null;
   return {actorId:x.actor_id,challenge:x.challenge,createdAt:new Date(x.created_at).getTime(),expiresAt:new Date(x.expires_at).getTime(),used:x.used_at!=null,action:x.action??undefined,payloadHash:x.payload_hash??undefined};
  },
  async consumeChallenge(id,actorId,now){
   if(!Number.isSafeInteger(now)||now<0)return false;
   const r=await query('UPDATE vice_private.passkey_auth_challenges SET used_at=to_timestamp($3::double precision/1000) WHERE id=$1 AND actor_id=$2 AND used_at IS NULL AND created_at<=to_timestamp($3::double precision/1000) AND expires_at>to_timestamp($3::double precision/1000) RETURNING id',[id,actorId,now]);
   return r.rowCount===1;
  }
 };
}
