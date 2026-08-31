import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { listMyChallenges, type Challenge } from '../lib/challenges';
import { toLocalDateString } from '../lib/date';
import { syncRecentSteps } from '../lib/stepSync';
import ChallengeCard from '../components/ChallengeCard';
import { useAuth } from '../context/AuthProvider';

function isActive(challenge: Challenge) {
  const today = toLocalDateString(new Date());
  return challenge.end_date >= today;
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile, signOut } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (session) {
      syncRecentSteps(session.user.id).catch((err) => console.warn('Step sync failed', err));
    }
    try {
      setChallenges(await listMyChallenges());
    } catch (err) {
      console.warn('Failed to load challenges', err);
    }
  }, [session]);

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

  const active = challenges.filter(isActive);
  const past = challenges.filter((c) => !isActive(c));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey, {profile?.display_name}</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          sections={[
            { title: 'Active', data: active },
            { title: 'Past', data: past },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: item.id } })}
            >
              <ChallengeCard challenge={item} />
            </Pressable>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.empty}>
                {section.title === 'Active' ? 'No active challenges yet.' : 'No past challenges.'}
              </Text>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={() => router.push('/create')}>
          <Text style={styles.actionButtonText}>Create Challenge</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/join')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
            Join with Code
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
  },
  signOut: {
    fontSize: 14,
    color: '#666',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonSecondaryText: {
    color: '#000',
  },
});
