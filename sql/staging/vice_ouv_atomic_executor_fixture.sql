-- STAGING-ONLY fixture replay. Never apply to production.
-- Transactional function runs with caller privileges; no browser access.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vice_ouv_staging_fixture;
REVOKE ALL ON SCHEMA vice_ouv_staging_fixture FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS vice_ouv_staging_fixture.proposals (
 id text PRIMARY KEY, status text NOT NULL CHECK(status IN ('REVIEW','LOCKED','EXECUTED')),
 payload_hash text NOT NULL, quorum_verified_at timestamptz, execute_after timestamptz);
CREATE TABLE IF NOT EXISTS vice_ouv_staging_fixture.config (
 id integer PRIMARY KEY CHECK(id=1), vice_price numeric(28,8) NOT NULL,
 v4x_price numeric(28,8) NOT NULL, total_vice bigint NOT NULL CHECK(total_vice=10000000),
 total_v4x bigint NOT NULL CHECK(total_v4x=10000000),
 CHECK(v4x_price=vice_price*160));
CREATE TABLE IF NOT EXISTS vice_ouv_staging_fixture.versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 proposal_id text NOT NULL UNIQUE REFERENCES vice_ouv_staging_fixture.proposals(id),
 vice_ouv numeric(28,8) NOT NULL,v4x_ouv numeric(28,8) NOT NULL);
CREATE TABLE IF NOT EXISTS vice_ouv_staging_fixture.receipts (
 proposal_id text PRIMARY KEY REFERENCES vice_ouv_staging_fixture.proposals(id),
 version_id bigint NOT NULL UNIQUE REFERENCES vice_ouv_staging_fixture.versions(id),
 payload_hash text NOT NULL);
CREATE OR REPLACE FUNCTION vice_ouv_staging_fixture.execute_test(
 p_id text,p_hash text,p_vice numeric,p_inject_failure boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE p record; v bigint; c record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
 SELECT * INTO STRICT p FROM vice_ouv_staging_fixture.proposals WHERE id=p_id FOR UPDATE;
 IF p.status<>'LOCKED' OR p.payload_hash<>p_hash OR p.quorum_verified_at IS NULL
 OR p.execute_after IS NULL OR p.execute_after>clock_timestamp() THEN
  RAISE EXCEPTION 'STAGING_GOVERNANCE_BLOCKED';
 END IF;
 SELECT * INTO STRICT c FROM vice_ouv_staging_fixture.config WHERE id=1 FOR UPDATE;
 IF c.total_vice<>10000000 OR c.total_v4x<>10000000 OR p_vice<=0
 THEN RAISE EXCEPTION 'STAGING_INTEGRITY_BLOCKED'; END IF;
 INSERT INTO vice_ouv_staging_fixture.versions(proposal_id,vice_ouv,v4x_ouv)
 VALUES(p_id,p_vice,p_vice*160) RETURNING id INTO v;
 INSERT INTO vice_ouv_staging_fixture.receipts(proposal_id,version_id,payload_hash)
 VALUES(p_id,v,p_hash);
 UPDATE vice_ouv_staging_fixture.config SET vice_price=p_vice,v4x_price=p_vice*160 WHERE id=1;
 UPDATE vice_ouv_staging_fixture.proposals SET status='EXECUTED' WHERE id=p_id;
 IF p_inject_failure THEN RAISE EXCEPTION 'STAGING_INJECTED_ROLLBACK'; END IF;
 RETURN v;
END $$;
ALTER TABLE vice_ouv_staging_fixture.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vice_ouv_staging_fixture.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vice_ouv_staging_fixture.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vice_ouv_staging_fixture.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA vice_ouv_staging_fixture FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vice_ouv_staging_fixture FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION vice_ouv_staging_fixture.execute_test(text,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
COMMIT;
