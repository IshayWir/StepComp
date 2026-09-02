import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import {
  computeBestDay,
  computeBestWeekday,
  getParticipantDailySteps,
  getParticipantDaysInLead,
  type DailyStepRow,
} from '../lib/participantSteps';

function formatShortDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function ParticipantDetailScreen() {
  const { id, userId, displayName } = useLocalSearchParams<{
    id: string;
    userId: string;
    displayName?: string;
  }>();
  const [rows, setRows] = useState<DailyStepRow[]>([]);
  const [daysInLead, setDaysInLead] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const [dailyRows, leadCount] = await Promise.all([
        getParticipantDailySteps(id, userId),
        getParticipantDaysInLead(id, userId),
      ]);
      setRows(dailyRows);
      setDaysInLead(leadCount);
    } catch (err) {
      console.warn('Failed to load participant steps', err);
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const bestDay = computeBestDay(rows);
  const bestWeekday = computeBestWeekday(rows);

  const chartData = rows.map((row) => ({
    value: row.step_count,
    label: formatShortDate(row.date),
  }));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: displayName ?? 'Steps' }} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {bestDay ? bestDay.steps.toLocaleString() : '—'}
              </Text>
              <Text style={styles.statLabel}>
                Best day{bestDay ? ` · ${formatShortDate(bestDay.date)}` : ''}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{daysInLead ?? '—'}</Text>
              <Text style={styles.statLabel}>Days in the lead</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{bestWeekday ? bestWeekday.weekday : '—'}</Text>
              <Text style={styles.statLabel}>Best weekday</Text>
            </View>
          </View>

          {chartData.length === 0 ? (
            <Text style={styles.empty}>No step data yet.</Text>
          ) : (
            <View style={styles.chartWrap}>
              <BarChart
                data={chartData}
                barWidth={20}
                spacing={16}
                initialSpacing={16}
                barBorderRadius={4}
                frontColor="#000"
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor="#e5e5e5"
                noOfSections={4}
                xAxisLabelTextStyle={styles.axisLabel}
                yAxisTextStyle={styles.axisLabel}
                isAnimated
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 14,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  chartWrap: {
    paddingVertical: 8,
  },
  axisLabel: {
    fontSize: 11,
    color: '#999',
  },
  empty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
  },
});
