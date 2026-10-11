-- ═══════════════════════════════════════════════════════════
-- VICE OS — Supabase Schema (Google-only, invite-gated)
-- ═══════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  name text,
  role text default 'HOLDER',
  title text default 'Member',
  phone text,
  jurisdiction text default 'CH',
  timezone text default 'UTC',
  avatar_initials text,
  vip_access boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- No auto-creation trigger. Profiles are created client-side, invite-gated.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.lookup_email_for_login(p_identifier text)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then return null; end if;
  if position('@' in p_identifier) > 0 then return lower(trim(p_identifier)); end if;
  select email into v_email from public.profiles where lower(username) = lower(trim(p_identifier)) limit 1;
  return v_email;
end;
$$;
grant execute on function public.lookup_email_for_login(text) to anon, authenticated;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  for_user text,
  role text default 'HOLDER',
  vip_access boolean default false,
  used boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.holders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text, email text, jurisdiction text,
  status text default 'ACTIVE',
  vice_units numeric default 0, v4x_units numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  holder_id uuid references public.holders(id) on delete cascade,
  class text, units numeric default 0, price numeric default 0,
  status text default 'PENDING', created_at timestamptz default now()
);

create table if not exists public.ouv_versions (
  id uuid primary key default gen_random_uuid(),
  version text, vice_ouv numeric default 2, v4x_ouv numeric default 320,
  note text, effective_at timestamptz default now(), created_at timestamptz default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  title text, body text, status text default 'DRAFT',
  votes_for int default 0, votes_against int default 0, created_at timestamptz default now()
);

create table if not exists public.distributions (
  id uuid primary key default gen_random_uuid(),
  period text, total numeric default 0, per_unit numeric default 0,
  status text default 'DRAFT', created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text, type text, size_kb int, url text, uploaded_by text,
  created_at timestamptz default now()
);

create table if not exists public.data_rooms (
  id uuid primary key default gen_random_uuid(),
  name text, description text, access_level text default 'INTERNAL',
  created_at timestamptz default now()
);

create table if not exists public.compliance_cases (
  id uuid primary key default gen_random_uuid(),
  subject text, type text, status text default 'OPEN', risk text default 'LOW',
  assigned_to text, notes text, created_at timestamptz default now()
);

create table if not exists public.treasury_tx (
  id uuid primary key default gen_random_uuid(),
  direction text, asset text, amount numeric default 0,
  counterparty text, reference text, status text default 'PENDING',
  created_at timestamptz default now()
);

create table if not exists public.mt5_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  broker text, login text, server text,
  balance numeric default 0, equity numeric default 0,
  status text default 'CONNECTED',
  mode text default 'DEMO',
  display_mode text default 'AUTO',
  created_at timestamptz default now()
);

create table if not exists public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  institution text, account_number text, currency text default 'USD',
  balance numeric default 0, status text default 'ACTIVE',
  created_at timestamptz default now()
);

create table if not exists public.vip_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  from_user uuid references auth.users(id) on delete set null,
  from_name text, body text not null,
  created_at timestamptz default now()
);
create index if not exists vip_messages_channel_idx on public.vip_messages (channel_id, created_at desc);

create table if not exists public.vip_channels (
  id text primary key, name text not null, admin_only boolean default false,
  created_at timestamptz default now()
);
insert into public.vip_channels (id, name, admin_only) values
  ('general','general',false),('trading','trading',false),
  ('reserve','reserve',true),('treasury','treasury',true)
on conflict (id) do nothing;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text, action text, object_type text, object_id text,
  actor_id text, actor_role text, outcome text default 'SUCCESS',
  correlation_id text, created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.holders enable row level security;
alter table public.allocations enable row level security;
alter table public.ouv_versions enable row level security;
alter table public.proposals enable row level security;
alter table public.distributions enable row level security;
alter table public.documents enable row level security;
alter table public.data_rooms enable row level security;
alter table public.compliance_cases enable row level security;
alter table public.treasury_tx enable row level security;
alter table public.mt5_accounts enable row level security;
alter table public.external_accounts enable row level security;
alter table public.vip_messages enable row level security;
alter table public.vip_channels enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert with check (auth.uid() = id);

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated using (true);
drop policy if exists invites_update on public.invites;
create policy invites_update on public.invites for update to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['holders','allocations','ouv_versions','proposals','distributions',
    'documents','data_rooms','compliance_cases','treasury_tx','audit_log','vip_channels',
    'mt5_accounts','external_accounts'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (true)', t, t);
  end loop;
end $$;

drop policy if exists vip_messages_read on public.vip_messages;
create policy vip_messages_read on public.vip_messages for select to authenticated using (true);
drop policy if exists vip_messages_insert on public.vip_messages;
create policy vip_messages_insert on public.vip_messages for insert to authenticated with check (true);

alter publication supabase_realtime add table public.vip_messages;
alter publication supabase_realtime add table public.audit_log;

-- Bootstrap the owner invite. Replace email with YOURS before running, or leave generic.
insert into public.invites (code, for_user, role, vip_access, used)
values ('vice-bootstrap', 'KAHZI', 'SUPER_ADMIN', true, false)
on conflict (code) do nothing;