import {
  isHealthDataAvailable,
  requestAuthorization,
  queryStatisticsCollectionForQuantity,
  ComparisonPredicateOperator,
} from '@kingstinct/react-native-healthkit';
import { supabase } from './supabase';
import { toLocalDateString } from './date';

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';

let authorized = false;

async function ensureAuthorized(): Promise<boolean> {
  if (authorized) return true;
  if (!isHealthDataAvailable()) return false;

  authorized = await requestAuthorization({ toRead: [STEP_COUNT] });
  return authorized;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function queryDailySteps(from: Date, to: Date): Promise<{ date: string; steps: number }[]> {
  const results = await queryStatisticsCollectionForQuantity(
    STEP_COUNT,
    ['cumulativeSum'],
    startOfDay(from),
    { day: 1 },
    {
      unit: 'count',
      filter: {
        date: { startDate: from, endDate: to },
        // Anti-cheat: exclude steps a user typed in manually rather than
        // recorded by a device, per the product's HealthKit-only policy.
        NOT: [
          {
            metadata: {
              withMetadataKey: 'HKWasUserEntered',
              operatorType: ComparisonPredicateOperator.equalTo,
              value: true,
            },
          },
        ],
      },
    }
  );

  return results
    .filter((r) => r.startDate)
    .map((r) => ({
      date: toLocalDateString(r.startDate as Date),
      steps: Math.round(r.sumQuantity?.quantity ?? 0),
    }));
}

/**
 * Pulls the last `days` of step counts from HealthKit and upserts them into
 * `daily_steps`. Safe to call often (app foreground, pull-to-refresh) —
 * HealthKit's own aggregation already merges overlapping iPhone/Watch
 * sources, so this is just a fresh snapshot each time.
 */
export async function syncRecentSteps(userId: string, days = 14): Promise<void> {
  const ok = await ensureAuthorized();
  if (!ok) return;

  const to = new Date();
  const from = startOfDay(to);
  from.setDate(from.getDate() - (days - 1));

  const dailySteps = await queryDailySteps(from, to);
  if (dailySteps.length === 0) return;

  const { error } = await supabase
    .from('daily_steps')
    .upsert(
      dailySteps.map((d) => ({ user_id: userId, date: d.date, step_count: d.steps })),
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;
}
