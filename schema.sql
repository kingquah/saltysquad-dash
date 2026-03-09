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
