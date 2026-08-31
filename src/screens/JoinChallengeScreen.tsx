import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { joinChallengeByCode } from '../lib/challenges';

export default function JoinChallengeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const trimmed = code.trim();
  const valid = trimmed.length >= 6 && trimmed.length <= 8;

  const handleJoin = async () => {
    if (!valid) return;
    setJoining(true);
    try {
      await joinChallengeByCode(trimmed);
      router.back();
    } catch (err: any) {
      Alert.alert('Could not join challenge', err.message ?? 'Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter invite code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="ABC1234"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        autoFocus
      />
      <Pressable
        style={[styles.button, (!valid || joining) && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={!valid || joining}
      >
        <Text style={styles.buttonText}>{joining ? 'Joining…' : 'Join'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
