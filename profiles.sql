-- ============================================================
-- VibeAthon 6.0 — Full Database Schema
-- Run this ENTIRE file in Supabase SQL Editor (replaces profiles.sql)
-- ============================================================

-- ============ 0. PROFILES (created by trigger from auth.users) ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz default timezone('utc', now())
);

-- Fix for existing tables missing the cascade delete constraint
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- Table already exists from initial setup. Add role column.
alter table profiles
  add column if not exists role text not null default 'customer'
  check (role in ('customer', 'owner'));

-- ============ 1. MENU ITEMS ============
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  category text not null default 'general',
  image_url text,
  is_available boolean not null default true,  -- toggled live by owner
  is_active boolean not null default true,      -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 2. RESTAURANT TABLES ============
create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null unique,
  capacity int not null default 4,
  status text not null default 'available'
    check (status in ('available', 'occupied', 'reserved')),
  created_at timestamptz not null default now()
);

-- ============ 3. WAITLIST ============
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  party_size int not null default 1,
  phone text,
  status text not null default 'waiting'
    check (status in ('waiting', 'seated', 'cancelled')),
  table_id uuid references restaurant_tables(id) on delete set null,
  joined_at timestamptz not null default now(),
  seated_at timestamptz
);

-- ============ 4. ORDERS ============
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references restaurant_tables(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  status text not null default 'placed'
    check (status in ('placed', 'preparing', 'ready', 'served', 'billed', 'cancelled')),
  subtotal numeric(10,2) not null default 0,
  service_charge_applied boolean not null default false,
  service_charge_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ 5. ORDER ITEMS ============
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  item_total numeric(10,2) not null,
  notes text
);

-- ============ 6. FEEDBACK ============
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  menu_item_id uuid references menu_items(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  thumbs_up boolean,          -- true=👍 false=👎 null=text-only
  comment text,
  created_at timestamptz not null default now()
);

-- ============ RLS ============
alter table profiles enable row level security;
alter table menu_items enable row level security;
alter table restaurant_tables enable row level security;
alter table waitlist enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table feedback enable row level security;

-- helper: is the current user an owner?
create or replace function is_owner()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- profiles: customer sees own, owner sees all
drop policy if exists "profiles_own_read" on profiles;
drop policy if exists "profiles_owner_read" on profiles;
create policy "profiles_own_read" on profiles for select
  using (id = auth.uid());
create policy "profiles_owner_read" on profiles for select
  using (is_owner());
create policy "profiles_own_update" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- menu_items: everyone reads available+active, only owner writes
drop policy if exists "menu_public_read" on menu_items;
drop policy if exists "menu_owner_write" on menu_items;
create policy "menu_public_read" on menu_items for select
  using (is_available = true and is_active = true or is_owner());
create policy "menu_owner_write" on menu_items for all
  using (is_owner()) with check (is_owner());

-- restaurant_tables: everyone reads, only owner writes
drop policy if exists "tables_public_read" on restaurant_tables;
drop policy if exists "tables_owner_write" on restaurant_tables;
create policy "tables_public_read" on restaurant_tables for select using (true);
create policy "tables_owner_write" on restaurant_tables for all
  using (is_owner()) with check (is_owner());

-- waitlist: customer sees/creates own, owner sees/edits all
drop policy if exists "waitlist_own_read" on waitlist;
drop policy if exists "waitlist_own_insert" on waitlist;
drop policy if exists "waitlist_owner_update" on waitlist;
create policy "waitlist_own_read" on waitlist for select
  using (customer_id = auth.uid() or is_owner());
create policy "waitlist_own_insert" on waitlist for insert
  with check (customer_id = auth.uid() or is_owner());
create policy "waitlist_owner_update" on waitlist for update
  using (is_owner());

-- orders: customer sees/creates own, owner sees/edits all
drop policy if exists "orders_own_read" on orders;
drop policy if exists "orders_own_insert" on orders;
drop policy if exists "orders_owner_update" on orders;
create policy "orders_own_read" on orders for select
  using (customer_id = auth.uid() or is_owner());
create policy "orders_own_insert" on orders for insert
  with check (customer_id = auth.uid() or is_owner());
create policy "orders_owner_update" on orders for update
  using (is_owner() or customer_id = auth.uid());

-- order_items: follow parent order visibility
drop policy if exists "order_items_read" on order_items;
drop policy if exists "order_items_insert" on order_items;
create policy "order_items_read" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id
    and (o.customer_id = auth.uid() or is_owner())));
create policy "order_items_insert" on order_items for insert
  with check (exists (select 1 from orders o where o.id = order_id
    and (o.customer_id = auth.uid() or is_owner())));

-- feedback: anyone authenticated can insert, owner reads all, customer reads own
drop policy if exists "feedback_insert" on feedback;
drop policy if exists "feedback_read" on feedback;
create policy "feedback_insert" on feedback for insert
  with check (auth.uid() is not null);
create policy "feedback_read" on feedback for select
  using (customer_id = auth.uid() or is_owner());

-- ============ REALTIME ============
-- Enable Realtime for live menu + order status updates
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table restaurant_tables;
alter publication supabase_realtime add table waitlist;

-- ============ AUTO-PROFILE TRIGGER (keep from original setup) ============
-- Creates a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id, 
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
