-- =========================================================
-- StepComp: fix "today" to use the caller's local date
-- =========================================================
-- All three RPCs below previously clamped date ranges using Postgres's
-- current_date, which is the DB server's UTC calendar date. daily_steps.date
-- is written using the device's LOCAL calendar date (toLocalDateString), so
-- for any user not at UTC+0, the server's "today" can disagree with the
-- user's actual today for several hours a day — e.g. a challenge created in
-- the evening in a UTC-behind timezone gets a start_date of the local day,
-- but the DB's current_date has already rolled over to the next day,
-- producing an extra phantom day in ranges clamped to current_date.
--
-- Fix: each RPC now takes the caller's local "today" as an explicit
-- p_today date parameter instead of reading current_date server-side.

drop function if exists public.get_challenge_leaderboard(uuid);
drop function if exists public.get_participant_daily_steps(uuid, uuid);
drop function if exists public.get_participant_days_in_lead(uuid, uuid);

-- ---------------------------------------------------------
-- RPC: get_challenge_leaderboard
-- ---------------------------------------------------------
create function public.get_challenge_leaderboard(p_challenge_id uuid, p_today date)
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
      where ds.date between v_start and least(v_end, p_today)
    ), 0)::bigint as total_steps,
    coalesce(sum(ds.step_count) filter (
      where ds.date = p_today
    ), 0)::bigint as today_steps
  from public.challenge_participants cp
  join public.profiles p on p.id = cp.user_id
  left join public.daily_steps ds on ds.user_id = cp.user_id
  where cp.challenge_id = p_challenge_id
  group by p.id, p.display_name, p.avatar_url
  order by total_steps desc;
end;
$$;

grant execute on function public.get_challenge_leaderboard(uuid, date) to authenticated;

-- ---------------------------------------------------------
-- RPC: get_participant_daily_steps
-- ---------------------------------------------------------
create function public.get_participant_daily_steps(p_challenge_id uuid, p_user_id uuid, p_today date)
returns table (date date, step_count integer)
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

  if not exists (
    select 1 from public.challenge_participants
    where challenge_id = p_challenge_id and user_id = p_user_id
  ) then
    raise exception 'That user is not a participant of this challenge';
  end if;

  select start_date, end_date into v_start, v_end
  from public.challenges where id = p_challenge_id;

  return query
  select d::date, coalesce(ds.step_count, 0)
  from generate_series(v_start, least(v_end, p_today), interval '1 day') d
  left join public.daily_steps ds on ds.user_id = p_user_id and ds.date = d::date
  order by d;
end;
$$;

grant execute on function public.get_participant_daily_steps(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------
-- RPC: get_participant_days_in_lead
-- ---------------------------------------------------------
create function public.get_participant_days_in_lead(p_challenge_id uuid, p_user_id uuid, p_today date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_days_in_lead integer;
begin
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'Not a participant of this challenge';
  end if;

  if not exists (
    select 1 from public.challenge_participants
    where challenge_id = p_challenge_id and user_id = p_user_id
  ) then
    raise exception 'That user is not a participant of this challenge';
  end if;

  select start_date, end_date into v_start, v_end
  from public.challenges where id = p_challenge_id;

  with days as (
    select generate_series(v_start, least(v_end, p_today), interval '1 day')::date as d
  ),
  participants as (
    select user_id from public.challenge_participants where challenge_id = p_challenge_id
  ),
  daily_step_grid as (
    select p.user_id, d.d, coalesce(ds.step_count, 0) as step_count
    from participants p
    cross join days d
    left join public.daily_steps ds on ds.user_id = p.user_id and ds.date = d.d
  ),
  cumulative as (
    select
      user_id,
      d,
      sum(step_count) over (partition by user_id order by d) as cumulative_steps
    from daily_step_grid
  ),
  ranked as (
    select d, user_id, rank() over (partition by d order by cumulative_steps desc) as rnk
    from cumulative
  )
  select count(*) into v_days_in_lead
  from ranked
  where user_id = p_user_id and rnk = 1;

  return coalesce(v_days_in_lead, 0);
end;
$$;

grant execute on function public.get_participant_days_in_lead(uuid, uuid, date) to authenticated;
