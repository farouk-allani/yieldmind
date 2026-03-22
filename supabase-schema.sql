-- YieldMind Chat History Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Chat sessions table
create table if not exists chat_sessions (
  id uuid default gen_random_uuid() primary key,
  wallet_address text not null,
  title text not null default 'New conversation',
  hcs_topic_id text default null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Migration: add hcs_topic_id to existing chat_sessions table
-- (run this if table already exists)
-- ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS hcs_topic_id text default null;

-- Chat messages table
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  metadata jsonb default null,
  created_at timestamptz default now() not null
);

-- Indexes for fast lookups
create index if not exists idx_sessions_wallet on chat_sessions(wallet_address);
create index if not exists idx_sessions_updated on chat_sessions(updated_at desc);
create index if not exists idx_messages_session on chat_messages(session_id);
create index if not exists idx_messages_created on chat_messages(created_at asc);

-- Enable Row Level Security
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Allow all operations via anon key (since auth is wallet-based, not Supabase Auth)
create policy "Allow all on chat_sessions" on chat_sessions
  for all using (true) with check (true);

create policy "Allow all on chat_messages" on chat_messages
  for all using (true) with check (true);
