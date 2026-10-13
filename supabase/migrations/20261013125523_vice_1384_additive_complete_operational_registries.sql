
-- VICE OS 1.3.8.1 additive registry foundation.
-- Each table has RLS; privileged/service-managed records intentionally have no browser write policies.
-- Introducing a table is NOT evidence that a UI or external provider integration is operational.
create table if not exists public.contracts(
 id uuid primary key default gen_random_uuid(),
 holder_id uuid references public.holders(id) on delete restrict,
 document_id uuid references public.documents(id) on delete set null,
 contract_type text not null, status text not null default 'DRAFT'
   check(status in ('DRAFT','REVIEW','EXECUTED','SUPERSEDED','VOID')),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), executed_at timestamptz
);
create index if not exists contracts_holder_idx on public.contracts(holder_id);
create table if not exists public.recon_jobs(
 id uuid primary key default gen_random_uuid(), source text not null,
 status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','PASSED','FAILED','CANCELLED')),
 started_at timestamptz, finished_at timestamptz, result jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.vicebot_positions(
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
 symbol text not null, side text not null check(side in ('BUY','SELL')),
 quantity numeric not null check(quantity>0), execution_mode text not null default 'PAPER'
 check(execution_mode in ('PAPER','SIM')),
 opened_at timestamptz not null default now(), closed_at timestamptz,
 entry_price numeric, exit_price numeric, metadata jsonb not null default '{}'::jsonb
);
create index if not exists vicebot_positions_profile_idx on public.vicebot_positions(profile_id);
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null, title text not null check(length(title) between 1 and 200),
 body text not null default '', link text, read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists notifications_inbox_idx on public.notifications(profile_id,read_at,created_at desc);
create table if not exists public.sessions(
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 auth_session_id uuid, last_seen_at timestamptz, revoked_at timestamptz,
 device_label text, created_at timestamptz not null default now()
);
create index if not exists vice_sessions_profile_idx on public.sessions(profile_id);
comment on table public.sessions is 'Supplementary audit records only: auth.sessions and Supabase Auth remain authoritative.';
create table if not exists public.login_attempts(
 id uuid primary key default gen_random_uuid(), identifier_hash text not null,
 source_hash text, succeeded boolean not null default false,
 occurred_at timestamptz not null default now()
);
create index if not exists login_attempts_identifier_time_idx on public.login_attempts(identifier_hash,occurred_at desc);
create table if not exists public.api_keys(
 id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete set null,
 label text not null, key_hash text not null unique check(key_hash ~ '^[a-f0-9]{64}$'),
 scopes jsonb not null default '[]'::jsonb,
 expires_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists api_keys_owner_idx on public.api_keys(owner_id);
create table if not exists public.webhooks(
 id uuid primary key default gen_random_uuid(), label text not null,
 endpoint text not null check(endpoint like 'https://%'),
 secret_reference text, event_types jsonb not null default '[]'::jsonb,
 status text not null default 'DISABLED' check(status in ('DISABLED','ENABLED')),
 created_at timestamptz not null default now()
);
create table if not exists public.course_progress(
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 module_id text not null, chapter_n integer not null check(chapter_n>=0),
 read_at timestamptz, client_reported boolean not null default true,
 updated_at timestamptz not null default now(),
 unique(profile_id,module_id,chapter_n)
);
create index if not exists course_progress_profile_idx on public.course_progress(profile_id);
comment on table public.course_progress is 'Informational reading progress; not authoritative Academy exam eligibility.';
create table if not exists public.message_reactions(
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(char_length(reaction) between 1 and 20),
 created_at timestamptz not null default now(), unique(message_id,profile_id,reaction)
);
create index if not exists msg_reactions_profile_idx on public.message_reactions(profile_id);
create table if not exists public.message_status(
 id uuid primary key default gen_random_uuid(), dm_message_id uuid not null references public.dm_messages(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null check(status in ('SENT','DELIVERED','READ')),
 observed_at timestamptz not null default now(), unique(dm_message_id,recipient_id)
);
create index if not exists msg_status_recipient_idx on public.message_status(recipient_id);
create table if not exists public.user_preferences(
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 notifications jsonb not null default '{"digest":"off","distribution":true,"tier":true,"legacy":true}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.audit_retention(
 id uuid primary key default gen_random_uuid(), record_class text unique not null,
 retention_years integer not null check(retention_years between 1 and 100),
 legal_hold boolean not null default false,
 last_archived_at timestamptz, updated_at timestamptz not null default now()
);
do $$
declare t text;
begin
 foreach t in array array['contracts','recon_jobs','vicebot_positions','notifications','sessions',
 'login_attempts','api_keys','webhooks','course_progress','message_reactions','message_status',
 'user_preferences','audit_retention'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from public,anon,authenticated', t);
 end loop;
end $$;
grant select on public.notifications,public.user_preferences,public.course_progress,
 public.vicebot_positions,public.contracts to authenticated;
drop policy if exists notifications_member_select on public.notifications;
create policy notifications_member_select on public.notifications for select to authenticated
 using (profile_id=(select auth.uid()));
drop policy if exists preferences_member_select on public.user_preferences;
create policy preferences_member_select on public.user_preferences for select to authenticated
 using (profile_id=(select auth.uid()));
drop policy if exists progress_member_select on public.course_progress;
create policy progress_member_select on public.course_progress for select to authenticated
 using (profile_id=(select auth.uid()));
drop policy if exists paper_positions_member_select on public.vicebot_positions;
create policy paper_positions_member_select on public.vicebot_positions for select to authenticated
 using (profile_id=(select auth.uid()));
drop policy if exists contracts_holder_select on public.contracts;
create policy contracts_holder_select on public.contracts for select to authenticated
 using (exists (select 1 from public.holders h where h.id=contracts.holder_id
  and (h.user_id=(select auth.uid()) or h.profile_id=(select auth.uid()))) or (select public.is_super()));
create or replace function public.mark_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then
  raise exception 'Provisioned member required';
 end if;
 update public.notifications set read_at=now() where profile_id=auth.uid() and read_at is null;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.mark_notifications_read() from public,anon,authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
create or replace function public.unread_notification_count()
returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from public.notifications where profile_id=auth.uid() and read_at is null
$$;
revoke all on function public.unread_notification_count() from public,anon,authenticated;
grant execute on function public.unread_notification_count() to authenticated;
create or replace function public.notify_user(
 p_user_id uuid,p_kind text,p_title text,p_body text,p_link text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null or not public.is_super() then raise exception 'Issuer authorization required'; end if;
 if p_user_id is null or nullif(trim(p_kind),'') is null
    or char_length(coalesce(p_title,'')) not between 1 and 200
    or char_length(coalesce(p_body,''))>5000
 then raise exception 'Invalid notification';end if;
 insert into public.notifications(profile_id,kind,title,body,link)
 values(p_user_id,left(p_kind,64),p_title,p_body,p_link) returning id into new_id;
 return new_id;
end $$;
revoke all on function public.notify_user(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.notify_user(uuid,text,text,text,text) to authenticated;
