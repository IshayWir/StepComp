import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getChallenge, type Challenge } from '../lib/challenges';
import { getChallengeLeaderboard, type LeaderboardRow } from '../lib/leaderboard';
import { syncRecentSteps } from '../lib/stepSync';
import { useAuth } from '../context/AuthProvider';

export default function LeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    if (session) {
      await syncRecentSteps(session.user.id).catch((err) =>
        console.warn('Step sync failed', err)
      );
    }

    try {
      const [challengeData, leaderboardData] = await Promise.all([
        getChallenge(id),
        getChallengeLeaderboard(id),
      ]);
      setChallenge(challengeData);
      setRows(leaderboardData);
    } catch (err) {
      console.warn('Failed to load leaderboard', err);
    }
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: challenge?.name ?? 'Leaderboard' }} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {challenge && (
            <View style={styles.header}>
              <Text style={styles.dates}>
                {challenge.start_date} – {challenge.end_date}
              </Text>
              <Text style={styles.code}>Code: {challenge.invite_code}</Text>
            </View>
          )}

          <FlatList
            data={rows}
            keyExtractor={(row) => row.user_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No participants yet.</Text>}
            renderItem={({ item, index }) => (
              <View style={[styles.row, item.user_id === session?.user.id && styles.rowSelf]}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <View style={styles.stepsColumn}>
                  <Text style={styles.totalSteps}>{item.total_steps.toLocaleString()}</Text>
                  <Text style={styles.todaySteps}>
                    +{item.today_steps.toLocaleString()} today
                  </Text>
                </View>
              </View>
            )}
          />
        </>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  code: {
    fontSize: 13,
    color: '#999',
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  empty: {
    fontSize: 14,
    color: '#999',
    marginTop: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 12,
  },
  rowSelf: {
    backgroundColor: '#f7f7fb',
  },
  rank: {
    width: 24,
    fontSize: 15,
    fontWeight: '700',
    color: '#999',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  stepsColumn: {
    alignItems: 'flex-end',
  },
  totalSteps: {
    fontSize: 16,
    fontWeight: '700',
  },
  todaySteps: {
    fontSize: 12,
    color: '#999',
  },
});
