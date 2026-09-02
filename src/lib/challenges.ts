import { supabase } from './supabase';

export type Challenge = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  start_date: string;
  end_date: string;
  participant_limit: number;
  created_at: string;
};

export async function listMyChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getChallenge(id: string): Promise<Challenge> {
  const { data, error } = await supabase.from('challenges').select('*').eq('id', id).single();

  if (error) throw error;
  return data;
}

export async function createChallenge(
  name: string,
  startDate: string,
  endDate: string
): Promise<Challenge> {
  const { data, error } = await supabase.rpc('create_challenge', {
    p_name: name,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return data as Challenge;
}

export async function joinChallengeByCode(code: string): Promise<Challenge> {
  const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code });

  if (error) throw error;
  return data as Challenge;
}

export async function removeParticipant(challengeId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_participant', {
    p_challenge_id: challengeId,
    p_user_id: userId,
  });

  if (error) throw error;
}
