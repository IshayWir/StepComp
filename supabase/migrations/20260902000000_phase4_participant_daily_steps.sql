-- =========================================================
-- StepComp Phase 4: Participant Charts & Personal Records
-- =========================================================

-- ---------------------------------------------------------
-- RPC: get_participant_daily_steps
-- Day-by-day step counts for one participant within a challenge's
-- date range (clamped to today), zero-filled so charts have no
-- gaps. Both caller and target must be participants of the same
-- challenge — mirrors get_challenge_leaderboard's access model,
-- since daily_steps itself only allows self-reads.
-- ---------------------------------------------------------
create function public.get_participant_daily_steps(p_challenge_id uuid, p_user_id uuid)
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
  from generate_series(v_start, least(v_end, current_date), interval '1 day') d
  left join public.daily_steps ds on ds.user_id = p_user_id and ds.date = d::date
  order by d;
end;
$$;

grant execute on function public.get_participant_daily_steps(uuid, uuid) to authenticated;
