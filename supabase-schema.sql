-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → Run).
-- This creates all the tables the iBake app needs.

create table if not exists menu_items (
  id bigint generated always as identity primary key,
  name text not null,
  description text default '',
  price numeric not null default 0,
  category text not null default 'Cakes',
  image text default '',
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id bigint generated always as identity primary key,
  order_ref text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  items_json text not null,
  total numeric not null,
  payment_screenshot text default '',
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists admin_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null
);

create table if not exists settings (
  key text primary key,
  value text
);

-- Row Level Security: keep these tables locked down from public API access.
-- The app talks to Supabase using the service_role key (server-side only),
-- which bypasses RLS entirely, so this just protects against anyone using
-- your public anon key (if you ever add one) to read/write these tables directly.
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table admin_users enable row level security;
alter table settings enable row level security;
