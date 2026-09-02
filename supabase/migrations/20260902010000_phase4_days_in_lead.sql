-- =========================================================
-- StepComp Phase 4: "Days in the lead" personal record
-- =========================================================

-- ---------------------------------------------------------
-- RPC: get_participant_days_in_lead
-- Counts how many days (within the challenge's date range, up to
-- today) a participant had the highest cumulative step total among
-- all participants — ties for the lead count too. Same access model
-- as get_participant_daily_steps: caller and target must both be
-- participants of the challenge.
-- ---------------------------------------------------------
create function public.get_participant_days_in_lead(p_challenge_id uuid, p_user_id uuid)
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
    select generate_series(v_start, least(v_end, current_date), interval '1 day')::date as d
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

grant execute on function public.get_participant_days_in_lead(uuid, uuid) to authenticated;
