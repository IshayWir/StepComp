import { supabase } from './supabase';
import { toLocalDateString } from './date';

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_steps: number;
  today_steps: number;
};

export async function getChallengeLeaderboard(challengeId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_challenge_leaderboard', {
    p_challenge_id: challengeId,
    p_today: toLocalDateString(new Date()),
  });

  if (error) throw error;
  return data ?? [];
}
