// Phase 3.21 — trusted PostgreSQL SOC incident writer.
// Use a backend-only database connection. The DB role must have narrowly
// scoped privileges; never expose this adapter through a browser bundle.
export function makePgIncidentWriter(db){
  if(!db||typeof db.query!=='function')throw new TypeError('Database query adapter required');
  return async function writeIncidents(incidents){
    if(!Array.isArray(incidents)||incidents.length>1000)throw new TypeError('Invalid incident batch');
    let written=0;
    for(const incident of incidents){
      if(!incident||!(/^[a-f0-9]{64}$/.test(incident.source_event_key))||
         typeof incident.actor_reference!=='string'||incident.actor_reference.length>128||
         !['low','medium','high','critical'].includes(incident.severity)||
         !Number.isInteger(incident.risk_score)||incident.risk_score<0||incident.risk_score>100||
         !Array.isArray(incident.signals)||!Array.isArray(incident.categories)||
         typeof incident.rule_version!=='string')throw new TypeError('Invalid incident');
      const values=[
        incident.source_event_key,incident.actor_reference,incident.severity,
        incident.risk_score,JSON.stringify(incident.signals),JSON.stringify(incident.categories),
        incident.rule_version,incident.first_seen_at,incident.last_seen_at
      ];
      const sql=`INSERT INTO public.vice_soc_incidents
        (source_event_key,actor_reference,severity,risk_score,signals,categories,rule_version,first_seen_at,last_seen_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::timestamptz,$9::timestamptz)
        ON CONFLICT (source_event_key) DO NOTHING RETURNING source_event_key`;
      const result=await db.query(sql,values);
      if(result?.rowCount===1)written++;
    }
    return written;
  };
}
