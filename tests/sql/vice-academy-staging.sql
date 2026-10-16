\set ON_ERROR_STOP on
-- Disposable fixtures only. No real members, answers or awards.
ALTER TABLE public.profiles ADD name text,ADD email text;
UPDATE public.profiles SET name='Synthetic Student',email='student@example.invalid';
CREATE TABLE public.academy_answer_keys(module text PRIMARY KEY);
INSERT INTO public.academy_answer_keys SELECT unnest(ARRAY['I','II','III','IV','V','VI','VII']);
CREATE TABLE public.academy_attempts(profile_id uuid,module text,score int,passed boolean);
CREATE TABLE public.certificates(cert_id text PRIMARY KEY,profile_id uuid,holder_name text,holder_email text,course_title text,scores jsonb,overall_score int,digest text,salt text,issued_at timestamptz DEFAULT now(),revoked boolean DEFAULT false,expires_at timestamptz);
INSERT INTO public.academy_attempts SELECT '00000000-0000-4000-8000-000000000001'::uuid,module,75,true FROM public.academy_answer_keys;
