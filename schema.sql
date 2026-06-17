-- One Thing Journal: database schema.
-- Run this once in the Supabase SQL editor (Database > SQL editor > New query).

-- ============ TABLES ============

-- One profile row per user, mirrors auth.users.id.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text default ''::text,
  phone text default ''::text,
  rest_day text default null,
  quotes jsonb default '[{"q": "Life shrinks or expands in proportion to one''s courage.", "a": "Anaïs Nin"}, {"q": "Feel the fear and do it anyway.", "a": ""}, {"q": "You be you and let the world adjust.", "a": "Mark Groves"}, {"q": "Failure is inextricably connected to any major success I''ve ever had.", "a": "Kyle Maynard"}, {"q": "I aspire to work with people that I can work with forever.", "a": "Naval Ravikant"}, {"q": "Don''t be the hero, be the guide. Invite customers into a story.", "a": "Donald Miller"}, {"q": "Things which matter most must never be at the mercy of things which matter least.", "a": "Goethe"}]'::jsonb,
  categories jsonb,
  goal_categories jsonb,
  goals jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- One entry row per user per date. The day plan lives in data (JSONB).
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

drop policy if exists entries_select_own on public.entries;
drop policy if exists entries_insert_own on public.entries;
drop policy if exists entries_update_own on public.entries;
drop policy if exists entries_delete_own on public.entries;
create policy entries_select_own on public.entries for select using (auth.uid() = user_id);
create policy entries_insert_own on public.entries for insert with check (auth.uid() = user_id);
create policy entries_update_own on public.entries for update using (auth.uid() = user_id);
create policy entries_delete_own on public.entries for delete using (auth.uid() = user_id);

-- ============ SIGNUP TRIGGER ============
-- Seeds a profile (Saturday rest day + default quotes) for every new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $func$
begin
  insert into public.profiles (id, email, name, rest_day, quotes)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    null,
    '[{"q": "Life shrinks or expands in proportion to one''s courage.", "a": "Anaïs Nin"}, {"q": "Feel the fear and do it anyway.", "a": ""}, {"q": "You be you and let the world adjust.", "a": "Mark Groves"}, {"q": "Failure is inextricably connected to any major success I''ve ever had.", "a": "Kyle Maynard"}, {"q": "I aspire to work with people that I can work with forever.", "a": "Naval Ravikant"}, {"q": "Don''t be the hero, be the guide. Invite customers into a story.", "a": "Donald Miller"}, {"q": "Things which matter most must never be at the mercy of things which matter least.", "a": "Goethe"}]'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
