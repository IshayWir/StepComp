import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = displayName.trim();

  const handleSave = async () => {
    if (!trimmed || !session) return;

    setSaving(true);
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      display_name: trimmed,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Could not save name', error.message);
      return;
    }

    await refreshProfile();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick a display name</Text>
      <Text style={styles.subtitle}>This is what other players see on the leaderboard.</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        maxLength={30}
        autoCapitalize="words"
        autoFocus
      />
      <Pressable
        style={[styles.button, (!trimmed || saving) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!trimmed || saving}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
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
