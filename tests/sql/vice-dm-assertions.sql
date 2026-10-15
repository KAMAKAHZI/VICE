\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000002','authorized');
INSERT INTO storage.objects(bucket_id,name) VALUES('vice-chat-media','dm/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000001/image.png');
DO $$BEGIN
 IF (SELECT count(*) FROM public.profiles)<>1 THEN RAISE EXCEPTION 'Profile privacy weakened';END IF;
 BEGIN
 INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','forged');
 RAISE EXCEPTION 'Sender spoof accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000099','unknown');
 RAISE EXCEPTION 'Unknown recipient accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES(auth.uid(),auth.uid(),'self');
 RAISE EXCEPTION 'Self-DM accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000002',repeat('x',10001));
 RAISE EXCEPTION 'Oversize accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO storage.objects(bucket_id,name) VALUES('vice-chat-media','dm/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000001/image.png');
 RAISE EXCEPTION 'Unknown media recipient accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO storage.objects(bucket_id,name) VALUES('vice-chat-media','ch/reserve/00000000-0000-4000-8000-000000000001/image.png');
 RAISE EXCEPTION 'Holder staff-channel media accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'PASS sender, recipient, profile privacy, length and media ACL';
END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$BEGIN IF (SELECT count(*) FROM public.dm_messages)<>1 THEN RAISE EXCEPTION 'Recipient cannot read DM'; END IF; END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
DO $$BEGIN IF (SELECT count(*) FROM public.dm_messages)<>0 THEN RAISE EXCEPTION 'Unrelated member can read DM'; END IF; END$$;
RESET ROLE;
SET ROLE anon;
DO $$BEGIN
 BEGIN PERFORM vice_private.is_member_peer('00000000-0000-4000-8000-000000000002');
 RAISE EXCEPTION 'Anonymous membership oracle allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;
\echo PASS all isolated database policy assertions
