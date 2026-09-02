import { supabase } from './supabase';
import { toLocalDateString } from './date';

export type DailyStepRow = {
  date: string;
  step_count: number;
};

export async function getParticipantDailySteps(
  challengeId: string,
  userId: string
): Promise<DailyStepRow[]> {
  const { data, error } = await supabase.rpc('get_participant_daily_steps', {
    p_challenge_id: challengeId,
    p_user_id: userId,
    p_today: toLocalDateString(new Date()),
  });

  if (error) throw error;
  return data ?? [];
}

export async function getParticipantDaysInLead(
  challengeId: string,
  userId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_participant_days_in_lead', {
    p_challenge_id: challengeId,
    p_user_id: userId,
    p_today: toLocalDateString(new Date()),
  });

  if (error) throw error;
  return data ?? 0;
}

export function computeBestDay(rows: DailyStepRow[]): { date: string; steps: number } | null {
  if (rows.length === 0) return null;

  const best = rows.reduce((max, row) => (row.step_count > max.step_count ? row : max));
  return { date: best.date, steps: best.step_count };
}

/** Average daily steps across the challenge's elapsed range so far (zero-step days included). */
export function computeAverage(rows: DailyStepRow[]): number | null {
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.step_count, 0);
  return Math.round(total / rows.length);
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Day-of-week with the highest average steps. Needs at least a full week of
 * data to be meaningful, otherwise a single sample would "win" a weekday outright.
 */
export function computeBestWeekday(rows: DailyStepRow[]): { weekday: string; average: number } | null {
  if (rows.length < 7) return null;

  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const row of rows) {
    const day = new Date(`${row.date}T00:00:00`).getDay();
    totals[day] += row.step_count;
    counts[day] += 1;
  }

  let bestDay = -1;
  let bestAverage = -1;
  for (let day = 0; day < 7; day++) {
    if (counts[day] === 0) continue;
    const average = totals[day] / counts[day];
    if (average > bestAverage) {
      bestAverage = average;
      bestDay = day;
    }
  }

  if (bestDay === -1) return null;
  return { weekday: WEEKDAY_NAMES[bestDay], average: Math.round(bestAverage) };
}
