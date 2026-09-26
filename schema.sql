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

-- OPTIONAL DEMO SEED — NOT EXECUTED.
-- Every line below is a SQL comment. Nothing here runs if you execute this file.
-- Do not paste it into production. It is a shape example only, not a balance.
-- -- insert into traffic_deals (project_name, aca_id, entity, amount_myr, deal_close_date, expected_collection_date)
-- -- values ('DEMO project — delete me', 'DEMO-ACA', 'saltyskins_my', 100.00, current_date, current_date);
