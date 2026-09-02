-- =========================================================
-- StepComp Phase 4: Owner permissions — remove a participant
-- =========================================================

-- ---------------------------------------------------------
-- RPC: remove_participant
-- Only the challenge creator (challenges.created_by) may remove another
-- participant. The creator can't remove themselves — leaving/deleting a
-- challenge is a separate, not-yet-built concern. Removal is a plain
-- delete (not a ban): the removed user can rejoin later with the invite
-- code, same as anyone else.
-- ---------------------------------------------------------
create function public.remove_participant(p_challenge_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  select created_by into v_created_by
  from public.challenges where id = p_challenge_id;

  if v_created_by is null then
    raise exception 'Challenge not found';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'Only the challenge creator can remove participants';
  end if;

  if p_user_id = v_created_by then
    raise exception 'The creator cannot remove themselves';
  end if;

  delete from public.challenge_participants
  where challenge_id = p_challenge_id and user_id = p_user_id;
end;
$$;

grant execute on function public.remove_participant(uuid, uuid) to authenticated;
