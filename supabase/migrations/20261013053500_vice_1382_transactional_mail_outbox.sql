create table if not exists public.email_outbox (
 id uuid primary key default gen_random_uuid(),
 event_key text not null unique,
 kind text not null check(kind in (
 'WELCOME_EMAIL','INVITE_EMAIL','INVITE_REMINDER_EMAIL','COURSE_CERTIFICATE_EMAIL','TOKEN_CERTIFICATE_EMAIL',
 'DISTRIBUTION_EMAIL','DISTRIBUTION_PENDING_EMAIL','TIER_ASSIGNED_EMAIL','LEGACY_RECORDED_EMAIL',
 'ENTRY_CLASS_RECORDED_EMAIL','REVOCATION_EMAIL','PASSWORD_RESET_EMAIL','SECURITY_ALERT_EMAIL',
 'NOTIFICATION_DIGEST_EMAIL')),
 email_to text not null,
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'PENDING' check(status in ('PENDING','SENDING','SENT','FAILED')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 available_at timestamptz not null default now(),
 sent_at timestamptz,
 last_error text,
 created_at timestamptz not null default now()
);
create index if not exists vice_email_outbox_pending_idx on public.email_outbox(status,available_at,created_at);
alter table public.email_outbox enable row level security;
revoke all on table public.email_outbox from public,anon,authenticated;
create or replace function public.trg_queue_token_cert_mail()
returns trigger language plpgsql security definer set search_path='' as $$
declare address text;kind text;key text;link text;p jsonb;
begin
 if tg_op='INSERT' then kind:='TOKEN_CERTIFICATE_EMAIL';key:='issue:'||new.cert_id;
 elsif tg_op='UPDATE' and new.revoked=true and old.revoked=false then kind:='REVOCATION_EMAIL';key:='revoke:'||new.cert_id;
 else return new;end if;
 select coalesce(nullif(h.email,''),nullif(pf.email,'')) into address
 from public.holders h left join public.profiles pf on pf.id=coalesce(h.profile_id,h.user_id)
 where h.id=new.holder_id;
 if coalesce(address,'')='' then return new;end if;
 link:='https://vice4x.netlify.app/verify.html?id='||new.cert_id;
 p:=jsonb_build_object('cert_id',new.cert_id,'kind',new.kind,'program',new.program,
 'units',new.units,'issued_at',new.issued_at,'verify_url',link,'reason',new.revoked_reason,'revoked_at',new.revoked_at);
 insert into public.email_outbox(event_key,kind,email_to,payload)
 values(key,kind,address,p) on conflict(event_key) do nothing;
 return new;
end $$;
revoke all on function public.trg_queue_token_cert_mail() from public,anon,authenticated;
drop trigger if exists token_cert_mail_created on public.token_certificates;
create trigger token_cert_mail_created after insert on public.token_certificates
 for each row execute function public.trg_queue_token_cert_mail();
drop trigger if exists token_cert_mail_revoked on public.token_certificates;
create trigger token_cert_mail_revoked after update of revoked on public.token_certificates
 for each row execute function public.trg_queue_token_cert_mail();
