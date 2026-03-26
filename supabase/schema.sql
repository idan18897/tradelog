-- TradeLog Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Trades table
create table if not exists trades (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  day text,
  time text,
  pair text not null,
  direction text not null check (direction in ('Long', 'Short')),
  entry numeric,
  sl numeric,
  tp numeric,
  sl_pips numeric,
  rr_potential numeric,
  risk_pct numeric default 0.5,
  confirmations text[] default '{}',
  outcome text default 'Open' check (outcome in ('TP', 'SL', 'BE', 'Invalid', 'Open')),
  screenshot_url text,
  notes text,
  week_number int,
  created_at timestamptz default now()
);

-- Confirmations library table
create table if not exists confirmations_library (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  sort_order int default 0,
  unique (user_id, label)
);

-- Enable RLS on trades
alter table trades enable row level security;

-- RLS policies for trades
create policy "Users can select own trades"
  on trades for select
  using (auth.uid() = user_id);

create policy "Users can insert own trades"
  on trades for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trades"
  on trades for update
  using (auth.uid() = user_id);

create policy "Users can delete own trades"
  on trades for delete
  using (auth.uid() = user_id);

-- Enable RLS on confirmations_library
alter table confirmations_library enable row level security;

-- RLS policies for confirmations_library
create policy "Users can select own confirmations"
  on confirmations_library for select
  using (auth.uid() = user_id);

create policy "Users can insert own confirmations"
  on confirmations_library for insert
  with check (auth.uid() = user_id);

create policy "Users can update own confirmations"
  on confirmations_library for update
  using (auth.uid() = user_id);

create policy "Users can delete own confirmations"
  on confirmations_library for delete
  using (auth.uid() = user_id);

-- Function to create default confirmations for new users
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into confirmations_library (user_id, label, sort_order) values
    (new.id, 'MSS', 1),
    (new.id, 'OB', 2),
    (new.id, 'FVG', 3),
    (new.id, 'Liquidity', 4),
    (new.id, 'BOS', 5),
    (new.id, 'Trend', 6),
    (new.id, 'HTF Align', 7),
    (new.id, 'Session', 8);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to run handle_new_user after a new user signs up
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

create policy "Users upload own screenshots"
  on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read screenshots"
  on storage.objects for select
  using (bucket_id = 'screenshots');

create policy "Users delete own screenshots"
  on storage.objects for delete
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);
