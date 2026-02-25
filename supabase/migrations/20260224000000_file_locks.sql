-- PROJ-5: file_locks table for pessimistic locking
-- One lock per file_type; unique constraint prevents race conditions.

create table if not exists public.file_locks (
  id uuid default gen_random_uuid() primary key,
  file_type text not null unique check (file_type in ('instance_profile', 'rules')),
  locked_by uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

-- Enable RLS
alter table public.file_locks enable row level security;

-- Any authenticated user can read lock status
create policy "Anyone can read locks"
  on public.file_locks for select
  to authenticated
  using (true);

-- Only the lock owner can insert (acquire) a lock
create policy "Authenticated users can acquire locks"
  on public.file_locks for insert
  to authenticated
  with check (locked_by = auth.uid());

-- Lock owner can update their own lock (heartbeat)
create policy "Lock owner can update heartbeat"
  on public.file_locks for update
  to authenticated
  using (locked_by = auth.uid());

-- Lock owner can release their own lock
create policy "Lock owner can delete own lock"
  on public.file_locks for delete
  to authenticated
  using (locked_by = auth.uid());

-- Admins can delete any lock (for stale lock override)
-- This requires checking user_profiles.role via a function
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$;

create policy "Admins can delete any lock"
  on public.file_locks for delete
  to authenticated
  using (public.is_admin());

-- Index for quick lookup by file_type
create index if not exists idx_file_locks_file_type on public.file_locks(file_type);
