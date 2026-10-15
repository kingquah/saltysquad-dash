-- ── SALTYSQUAD DASH — Supabase Schema ────────────────────────────────────────
-- Run this entire file in Supabase Dashboard → SQL Editor

-- 1. USERS
create table if not exists users (
  id          serial primary key,
  name        text not null,
  email       text unique not null,
  password    text not null,
  role        text not null check (role in ('admin', 'supervisor', 'staff')),
  job_title   text,
  avatar      text,
  annual_left integer not null default 12
);

-- 2. LEAVE REQUESTS
create table if not exists leave_requests (
  id        uuid default gen_random_uuid() primary key,
  user_id   integer references users(id) on delete cascade,
  type      text not null default 'Annual',
  from_date date not null,
  to_date   date not null,
  days      integer not null,
  reason    text,
  status    text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected'))
);

-- 3. CHECKLIST SUBMISSIONS
create table if not exists checklist_submissions (
  id        uuid default gen_random_uuid() primary key,
  user_id   integer references users(id) on delete cascade,
  month_key text not null,   -- format: "YYYY-MM"  e.g. "2026-03"
  checks    jsonb not null default '{}',
  remarks   text not null default '',
  unique (user_id, month_key)
);

-- 4. SALES TARGETS
create table if not exists sales_targets (
  id       serial primary key,
  month    text not null,    -- "Jan" .. "Dec"
  year     integer not null default extract(year from current_date)::integer,
  target   bigint not null default 500000,
  achieved bigint not null default 0,
  unique (month, year)
);

-- ── RLS: disable for all tables (app uses its own auth, not Supabase Auth) ──
-- If RLS is on, the anon key cannot read/write any rows.
-- Run these if your tables were created with RLS enabled via the dashboard.
alter table users disable row level security;
alter table leave_requests disable row level security;
alter table checklist_submissions disable row level security;
alter table sales_targets disable row level security;

-- ── SEED DATA ────────────────────────────────────────────────────────────────

insert into users (id, name, email, password, role, job_title, avatar, annual_left) values
  (1, 'King Quah',      'king@saltycustoms.com',     'king123',     'admin',      'Founder',                           'KQ', 12),
  (2, 'Wilson Goh',     'wilson@saltycustoms.com',   'wilson123',   'supervisor', 'Managing Director',                 'WG', 12),
  (3, 'Puteri Inez',    'puteri@saltycustoms.com',   'puteri123',   'supervisor', 'Vice President',                    'PI', 12),
  (4, 'Adam Malek',     'adamo@saltycustoms.com',    'adam123',     'staff',      'Creative Director',                 'AM', 12),
  (5, 'Angeline Chua',  'angeline@saltycustoms.com', 'angeline123', 'staff',      'Head of Growth',                    'AC', 12),
  (6, 'Leon Lim',       'leon@saltycustoms.com',     'leon123',     'staff',      'Business Development Executive',    'LL', 12),
  (7, 'Eric Tai',       'jason@saltycustoms.com',    'eric123',     'staff',      'Sales & Performance Executive',     'ET', 12),
  (8, 'Justin Shye',    'shye@saltycustoms.com',     'justin123',   'staff',      'Special Officer',                   'JS', 12)
on conflict (id) do nothing;

-- Seed sales targets for the current year
insert into sales_targets (month, year, target, achieved)
select m, extract(year from current_date)::integer, 500000, 0
from unnest(array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']) as m
on conflict (month, year) do nothing;

-- ── BUDGET TRACKER ───────────────────────────────────────────────────────────
-- Wide-grid budget: each line has ONE monthly-budgeted target + 12 monthly
-- actuals (stored as jsonb keyed "Jan".."Dec"). Line-item structure, labels and
-- subtotal/Net-Profit formulas live in the app (budget-data.js). Subtotals are
-- computed live, not stored.

-- 5. BUDGET LINES — one row per (year, line item)
create table if not exists budget_lines (
  id             uuid default gen_random_uuid() primary key,
  year           integer not null default extract(year from current_date)::integer,
  line_key       text not null,           -- matches a key in budget-data.js
  monthly_budget numeric not null default 0,
  actuals        jsonb not null default '{}',   -- { "Jan": 0, "Feb": 0, ... }
  unique (year, line_key)
);

-- 6. BUDGET MONTH STATUS — per-month "checked & good" flag (legend coloring).
create table if not exists budget_month_status (
  year    integer not null,
  month   text not null,                 -- "Jan" .. "Dec"
  checked boolean not null default false,
  unique (year, month)
);

-- 7. BUDGET LINE VISIBILITY — which lines non-editor staff may view.
--    Default: hidden. King / Puteri / Wilson flip individual lines on.
create table if not exists budget_line_visibility (
  line_key      text primary key,
  staff_visible boolean not null default false
);

-- 8. BUDGET AUDIT — every budget/actual/visibility/month-status change.
create table if not exists budget_audit (
  id         uuid default gen_random_uuid() primary key,
  line_key   text not null,
  year       integer,
  month      text,
  field      text not null,             -- 'budget' | 'actual' | 'visibility' | 'month_status'
  old_value  text,
  new_value  text,
  user_id    integer,
  user_name  text,
  created_at timestamptz not null default now()
);

create index if not exists budget_audit_created_idx on budget_audit (created_at desc);

-- Old per-month table from the first version is no longer used.
drop table if exists budget_entries;

alter table budget_lines          disable row level security;
alter table budget_month_status   disable row level security;
alter table budget_line_visibility disable row level security;
alter table budget_audit          disable row level security;

-- 4b. SALES ENTRIES — Scoreboard rows. Already live in production.
-- Included so a fresh run of this file can satisfy the Traffic Board foreign key.
-- No seed rows. Does not enable RLS (anon key + custom users-table auth).
create table if not exists sales_entries (
  id          serial primary key,
  user_id     integer references users(id),
  category    text check (category in ('sales_closed', 'pipeline', 'invoice', 'quotation')),
  client_name text,
  amount      numeric,
  entry_date  date,
  created_at  timestamp default now()
);

alter table sales_entries disable row level security;

-- >>> TRAFFIC_BOARD_MIGRATION_START
-- ── NEW TABLES ONLY — Traffic Board (production migration) ──────────────────
-- Run THIS SECTION in Supabase → SQL Editor on the live project.
-- Idempotent. Safe to re-run.
-- Does not ALTER existing tables and does not enable or disable RLS on them.
-- Does not insert money.
-- New tables match the app's custom login (not Supabase Auth): RLS is disabled
-- on these new tables only, same as users / sales_entries / budget, so the
-- anon key can read and write. The dash gates edits to admin and supervisor.

-- 9. TRAFFIC DEALS — one closed project. ACA ID is unique when present.
create table if not exists traffic_deals (
  id                       uuid primary key default gen_random_uuid(),
  sales_entry_id           integer references sales_entries(id) on delete set null,
  project_name             text not null,
  aca_id                   text,
  entity                   text not null check (entity in ('saltyskins_my', 'saltycustoms_sg')),
  ac_in_charge             text,
  lead_owner               text,
  product                  text,
  qty                      numeric(14, 2),
  deal_close_date          date,
  sales_type               text,
  amount_myr               numeric(14, 2) not null default 0 check (amount_myr >= 0),
  payment_terms            text,
  expected_collection_date date,
  costs_locked             boolean not null default false,
  created_by               integer,
  created_by_name          text,
  updated_by               integer,
  updated_by_name          text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- 10. COLLECTION EVENTS — source of truth for cash in (not a YES/NO flag).
create table if not exists traffic_collections (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references traffic_deals(id) on delete cascade,
  collected_at      date not null,
  amount            numeric(14, 2) not null check (amount > 0),
  note              text,
  recorded_by       integer,
  recorded_by_name  text,
  created_at        timestamptz not null default now()
);

-- 11. COST EVENTS — source of truth for COGS. Margin stays provisional until locked.
create table if not exists traffic_costs (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references traffic_deals(id) on delete cascade,
  cost_date         date not null,
  cost_type         text not null check (cost_type in ('fabric_print', 'logistics', 'misc', 'other')),
  amount            numeric(14, 2) not null check (amount >= 0),
  note              text,
  recorded_by       integer,
  recorded_by_name  text,
  created_at        timestamptz not null default now()
);

-- 12. AUDIT — who / what / before → after / when. deal_id is not a foreign key
-- so the trail remains after a deal is deleted.
create table if not exists traffic_audit (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid,
  project_name  text,
  aca_id        text,
  field         text not null,
  old_value     text,
  new_value     text,
  user_id       integer,
  user_name     text,
  created_at    timestamptz not null default now()
);

create unique index if not exists traffic_deals_aca_id_uidx
  on traffic_deals (lower(btrim(aca_id)))
  where aca_id is not null and btrim(aca_id) <> '';

create unique index if not exists traffic_deals_sales_entry_uidx
  on traffic_deals (sales_entry_id)
  where sales_entry_id is not null;

create index if not exists traffic_deals_close_idx on traffic_deals (deal_close_date desc);
create index if not exists traffic_deals_entity_idx on traffic_deals (entity);
create index if not exists traffic_collections_deal_idx on traffic_collections (deal_id);
create index if not exists traffic_costs_deal_idx on traffic_costs (deal_id);
create index if not exists traffic_audit_created_idx on traffic_audit (created_at desc);

create or replace function public.traffic_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists traffic_deals_touch on public.traffic_deals;
create trigger traffic_deals_touch
  before update on public.traffic_deals
  for each row execute function public.traffic_touch_updated_at();

revoke all on function public.traffic_touch_updated_at() from public, anon, authenticated;

alter table traffic_deals        disable row level security;
alter table traffic_collections  disable row level security;
alter table traffic_costs        disable row level security;
alter table traffic_audit        disable row level security;

grant select, insert, update, delete on traffic_deals        to anon, authenticated, service_role;
grant select, insert, update, delete on traffic_collections  to anon, authenticated, service_role;
grant select, insert, update, delete on traffic_costs        to anon, authenticated, service_role;
grant select, insert, update, delete on traffic_audit        to anon, authenticated, service_role;
-- >>> TRAFFIC_BOARD_MIGRATION_END

-- >>> COMMISSIONS_MIGRATION_START
-- ── NEW TABLES ONLY — Commissions (production migration) ────────────────────
-- Run THIS SECTION in Supabase → SQL Editor on the live project.
-- Idempotent. Safe to re-run.
-- Does not ALTER users, sales_entries, budget_*, or traffic_* tables.
-- Does not enable RLS on existing tables.
-- Seeds July 2026: Nokia S00359 excluded until collected, and one approved
-- (not paid) payout batch. It does not mark anything paid.
-- Not applied by the app. Run it by hand when you want the tables live.

-- 13. EXCLUSIONS — a deal the owner keeps out of the pool until it is collected.
create table if not exists commission_exclusions (
  id               uuid primary key default gen_random_uuid(),
  month_key        text not null,
  deal_id          uuid,
  aca_id           text,
  project_name     text,
  note             text,
  active           boolean not null default true,
  created_by       integer,
  created_by_name  text,
  created_at       timestamptz not null default now()
);

create unique index if not exists commission_exclusions_month_aca_uidx
  on commission_exclusions (month_key, lower(btrim(aca_id)))
  where aca_id is not null and btrim(aca_id) <> '' and active;

create unique index if not exists commission_exclusions_month_deal_uidx
  on commission_exclusions (month_key, deal_id)
  where deal_id is not null and active;

-- 14. PAYOUT BATCHES — approved means ready for the next payroll.
--     paid is immutable: one payroll date, never edited, never paid twice.
create table if not exists commission_payout_batches (
  id                uuid primary key default gen_random_uuid(),
  month_key         text not null,
  status            text not null check (status in ('approved', 'paid')),
  payroll_date      date,
  note              text,
  approved_by       integer,
  approved_by_name  text,
  approved_at       timestamptz,
  paid_by           integer,
  paid_by_name      text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  constraint commission_paid_has_payroll check (status <> 'paid' or payroll_date is not null)
);

create unique index if not exists commission_one_open_batch_uidx
  on commission_payout_batches (month_key)
  where status = 'approved';

-- 15. PAYOUT LINES — one row per person in the batch. MY + SG = amount.
create table if not exists commission_payout_lines (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references commission_payout_batches(id) on delete cascade,
  user_id      integer,
  person_key   text not null check (person_key in ('king', 'leon', 'wilson', 'puteri')),
  person_name  text not null,
  amount       numeric(14, 2) not null check (amount >= 0),
  amount_my    numeric(14, 2) not null check (amount_my >= 0),
  amount_sg    numeric(14, 2) not null check (amount_sg >= 0),
  unique (batch_id, person_key),
  constraint commission_line_entity_split check (round(amount_my + amount_sg, 2) = round(amount, 2))
);

-- 16. AUDIT — who approved, excluded, or marked a batch paid.
create table if not exists commission_audit (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid,
  month_key   text,
  action      text not null,
  old_value   text,
  new_value   text,
  user_id     integer,
  user_name   text,
  created_at  timestamptz not null default now()
);

create index if not exists commission_audit_created_idx on commission_audit (created_at desc);
create index if not exists commission_batches_month_idx on commission_payout_batches (month_key);

create or replace function public.commission_guard_batch()
returns trigger
language plpgsql
as $$
declare
  actor_role text;
begin
  if tg_op = 'DELETE' then
    if old.status = 'paid' then
      raise exception 'Paid commission batches are immutable';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid' then
    raise exception 'Paid commission batches are immutable';
  end if;

  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    if new.payroll_date is null then
      raise exception 'A paid commission batch needs a payroll date';
    end if;
    select role into actor_role from public.users where id = new.paid_by;
    if actor_role is distinct from 'admin' then
      raise exception 'Only an admin can mark a commission batch paid';
    end if;
    if new.paid_at is null then
      new.paid_at = now();
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from 'paid' and new.status = 'paid' then
    insert into public.commission_audit (batch_id, month_key, action, old_value, new_value, user_id, user_name)
    values (
      new.id,
      new.month_key,
      'marked_paid',
      old.status,
      'paid ' || to_char(new.payroll_date, 'YYYY-MM-DD'),
      new.paid_by,
      new.paid_by_name
    );
  end if;

  return new;
end;
$$;

create or replace function public.commission_guard_line()
returns trigger
language plpgsql
as $$
declare
  batch_status text;
  bid uuid;
begin
  bid := case when tg_op = 'DELETE' then old.batch_id else new.batch_id end;
  select status into batch_status from public.commission_payout_batches where id = bid;
  if batch_status = 'paid' then
    raise exception 'Paid commission batches are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists commission_batches_guard on public.commission_payout_batches;
create trigger commission_batches_guard
  before insert or update or delete on public.commission_payout_batches
  for each row execute function public.commission_guard_batch();

drop trigger if exists commission_lines_guard on public.commission_payout_lines;
create trigger commission_lines_guard
  before insert or update or delete on public.commission_payout_lines
  for each row execute function public.commission_guard_line();

revoke all on function public.commission_guard_batch() from public, anon, authenticated;
revoke all on function public.commission_guard_line() from public, anon, authenticated;

alter table commission_exclusions    disable row level security;
alter table commission_payout_batches disable row level security;
alter table commission_payout_lines  disable row level security;
alter table commission_audit         disable row level security;

grant select, insert, update, delete on commission_exclusions     to anon, authenticated, service_role;
grant select, insert, update, delete on commission_payout_batches to anon, authenticated, service_role;
grant select, insert, update, delete on commission_payout_lines   to anon, authenticated, service_role;
grant select, insert, update, delete on commission_audit          to anon, authenticated, service_role;

-- July 2026 seed. Nokia stays out of the pool until it is collected.
insert into commission_exclusions (month_key, deal_id, aca_id, project_name, note, active, created_by_name)
select '2026-07', d.id, 'S00359', coalesce(d.project_name, 'Nokia (Via Eventually)'), 'Excluded until collected', true, 'King Quah'
from traffic_deals d
where lower(btrim(d.aca_id)) = 's00359'
  and not exists (
    select 1 from commission_exclusions e
    where e.month_key = '2026-07' and lower(btrim(e.aca_id)) = 's00359'
  )
limit 1;

insert into commission_exclusions (month_key, deal_id, aca_id, project_name, note, active, created_by_name)
select '2026-07', null, 'S00359', 'Nokia (Via Eventually)', 'Excluded until collected', true, 'King Quah'
where not exists (
  select 1 from commission_exclusions e
  where e.month_key = '2026-07' and lower(btrim(e.aca_id)) = 's00359'
);

insert into commission_payout_batches (
  id, month_key, status, payroll_date, note, approved_by, approved_by_name, approved_at
)
select
  '20260715-0000-4000-8000-000000000001',
  '2026-07',
  'approved',
  null,
  'July 2026 ready to pay, approved by King. Not yet marked paid.',
  (select id from users where email = 'king@saltycustoms.com' limit 1),
  'King Quah',
  timestamptz '2026-07-31 00:00:00+00'
where not exists (
  select 1 from commission_payout_batches b
  where b.id = '20260715-0000-4000-8000-000000000001'
     or (b.month_key = '2026-07' and b.status = 'approved')
);

insert into commission_payout_lines (batch_id, user_id, person_key, person_name, amount, amount_my, amount_sg)
select '20260715-0000-4000-8000-000000000001', u.id, v.person_key, v.person_name, v.amount, v.amount_my, v.amount_sg
from (
  values
    ('wilson@saltycustoms.com', 'wilson', 'Wilson Goh',  4215.23::numeric, 2288.14::numeric, 1927.09::numeric),
    ('leon@saltycustoms.com',   'leon',   'Leon Lim',    1636.51::numeric,  888.34::numeric,  748.17::numeric),
    ('puteri@saltycustoms.com', 'puteri', 'Puteri Inez', 1344.41::numeric,  729.78::numeric,  614.63::numeric),
    ('king@saltycustoms.com',   'king',   'King Quah',   1028.02::numeric,  558.04::numeric,  469.98::numeric)
) as v(email, person_key, person_name, amount, amount_my, amount_sg)
left join users u on u.email = v.email
where exists (
  select 1 from commission_payout_batches b
  where b.id = '20260715-0000-4000-8000-000000000001'
)
and not exists (
  select 1 from commission_payout_lines l
  where l.batch_id = '20260715-0000-4000-8000-000000000001' and l.person_key = v.person_key
);

insert into commission_audit (batch_id, month_key, action, new_value, user_name)
select
  '20260715-0000-4000-8000-000000000001',
  '2026-07',
  'approved',
  'Ready to pay Wilson RM 4215.23, Leon RM 1636.51, Puteri RM 1344.41, King RM 1028.02',
  'King Quah'
where exists (
  select 1 from commission_payout_batches b
  where b.id = '20260715-0000-4000-8000-000000000001'
)
and not exists (
  select 1 from commission_audit a
  where a.batch_id = '20260715-0000-4000-8000-000000000001' and a.action = 'approved'
);
-- >>> COMMISSIONS_MIGRATION_END

-- OPTIONAL DEMO SEED — NOT EXECUTED.
-- Every line below is a SQL comment. Nothing here runs if you execute this file.
-- Do not paste it into production. It is a shape example only, not a balance.
-- -- insert into traffic_deals (project_name, aca_id, entity, amount_myr, deal_close_date, expected_collection_date)
-- -- values ('DEMO project — delete me', 'DEMO-ACA', 'saltyskins_my', 100.00, current_date, current_date);
