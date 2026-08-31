import { StyleSheet, Text, View } from 'react-native';
import type { Challenge } from '../lib/challenges';

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{challenge.name}</Text>
      <Text style={styles.dates}>
        {formatDate(challenge.start_date)} – {formatDate(challenge.end_date)}
      </Text>
      <Text style={styles.code}>Code: {challenge.invite_code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  dates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  code: {
    fontSize: 13,
    color: '#999',
    letterSpacing: 1,
  },
});
