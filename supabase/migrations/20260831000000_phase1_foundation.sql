-- =========================================================
-- StepComp Phase 1: Database Schema & Security Policies
-- =========================================================

-- ---------------------------------------------------------
-- profiles
-- One row per user. Created client-side once the user submits
-- a display name during onboarding (Sign in with Apple often
-- withholds real name/email, so we don't auto-populate via trigger).
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: self read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: self insert"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles: self update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------
-- challenges
-- ---------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  participant_limit integer not null default 750 check (participant_limit > 0),
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

-- ---------------------------------------------------------
-- challenge_participants
-- ---------------------------------------------------------
create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

-- ---------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER + owned by the migration role (which has
-- bypassrls) so these don't re-trigger the very policies that
-- call them — avoids self-referential RLS recursion on
-- challenge_participants.
-- ---------------------------------------------------------
create function public.is_challenge_participant(p_challenge_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants
    where challenge_id = p_challenge_id and user_id = auth.uid()
  );
$$;

create function public.shares_challenge_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.challenge_participants cp1
    join public.challenge_participants cp2 on cp1.challenge_id = cp2.challenge_id
    where cp1.user_id = auth.uid() and cp2.user_id = p_user_id
  );
$$;

-- Now that the helpers exist, add the cross-user read policies.

create policy "profiles: read co-participants"
  on public.profiles for select
  using (public.shares_challenge_with(id));

create policy "challenges: participants read"
  on public.challenges for select
  using (public.is_challenge_participant(id));

-- No direct insert/update policy on challenges: all writes go
-- through the SECURITY DEFINER RPCs below (create_challenge /
-- join_challenge_by_code), so arbitrary clients can't fabricate
-- invite codes or bypass the participant cap.

create policy "challenge_participants: co-participants read"
  on public.challenge_participants for select
  using (
    user_id = auth.uid()
    or public.is_challenge_participant(challenge_id)
  );

-- No direct insert policy on challenge_participants: membership
-- is only created via the RPCs below.

-- ---------------------------------------------------------
-- daily_steps
-- One row per user per day. Upserted directly by the client
-- (not via RPC) from on-device HealthKit aggregation.
-- ---------------------------------------------------------
create table public.daily_steps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  step_count integer not null default 0 check (step_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_steps enable row level security;

create policy "daily_steps: self read"
  on public.daily_steps for select
  using (user_id = auth.uid());

create policy "daily_steps: self insert"
  on public.daily_steps for insert
  with check (user_id = auth.uid());

create policy "daily_steps: self update"
  on public.daily_steps for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Cross-user step visibility for leaderboards happens only through
-- get_challenge_leaderboard() below, not via a SELECT policy — so a
-- user can never read another user's raw daily_steps rows directly.

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_steps_touch_updated_at
  before insert or update on public.daily_steps
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- RPC: create_challenge
-- Generates a collision-free invite code, creates the challenge,
-- and auto-joins the creator as the first participant.
-- ---------------------------------------------------------
create function public.create_challenge(
  p_name text,
  p_start_date date,
  p_end_date date
)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_challenge public.challenges;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I to avoid ambiguity
  v_attempt int := 0;
begin
  loop
    v_code := '';
    for i in 1..7 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      insert into public.challenges (name, invite_code, created_by, start_date, end_date)
      values (p_name, v_code, auth.uid(), p_start_date, p_end_date)
      returning * into v_challenge;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 10 then
        raise exception 'Could not generate a unique invite code, try again';
      end if;
    end;
  end loop;

  insert into public.challenge_participants (challenge_id, user_id)
  values (v_challenge.id, auth.uid());

  return v_challenge;
end;
$$;

grant execute on function public.create_challenge(text, date, date) to authenticated;

-- ---------------------------------------------------------
-- RPC: join_challenge_by_code
-- Looks up a challenge by invite code and joins the caller,
-- enforcing the soft participant cap. Idempotent if already joined.
-- ---------------------------------------------------------
create function public.join_challenge_by_code(p_code text)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges;
  v_count integer;
begin
  select * into v_challenge
  from public.challenges
  where invite_code = upper(p_code);

  if not found then
    raise exception 'Invite code not found';
  end if;

  select count(*) into v_count
  from public.challenge_participants
  where challenge_id = v_challenge.id;

  if v_count >= v_challenge.participant_limit then
    raise exception 'This challenge is full';
  end if;

  insert into public.challenge_participants (challenge_id, user_id)
  values (v_challenge.id, auth.uid())
  on conflict do nothing;

  return v_challenge;
end;
$$;

grant execute on function public.join_challenge_by_code(text) to authenticated;

-- ---------------------------------------------------------
-- RPC: get_challenge_leaderboard
-- Total steps (within the challenge's date range) + today's steps,
-- for every participant. Caller must be a participant.
-- ---------------------------------------------------------
create function public.get_challenge_leaderboard(p_challenge_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_steps bigint,
  today_steps bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
begin
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'Not a participant of this challenge';
  end if;

  select start_date, end_date into v_start, v_end
  from public.challenges where id = p_challenge_id;

  return query
  select
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(ds.step_count) filter (
      where ds.date between v_start and least(v_end, current_date)
    ), 0)::bigint as total_steps,
    coalesce(sum(ds.step_count) filter (
      where ds.date = current_date
    ), 0)::bigint as today_steps
  from public.challenge_participants cp
  join public.profiles p on p.id = cp.user_id
  left join public.daily_steps ds on ds.user_id = cp.user_id
  where cp.challenge_id = p_challenge_id
  group by p.id, p.display_name, p.avatar_url
  order by total_steps desc;
end;
$$;

grant execute on function public.get_challenge_leaderboard(uuid) to authenticated;
