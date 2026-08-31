import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createChallenge } from '../lib/challenges';
import { toLocalDateString } from '../lib/date';

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function CreateChallengeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => addDays(new Date(), 13));
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [creating, setCreating] = useState(false);

  const trimmedName = name.trim();
  const valid = trimmedName.length > 0 && endDate >= startDate;

  const handlePickerChange = (_event: unknown, selected?: Date) => {
    if (!selected || !activePicker) return;

    if (activePicker === 'start') {
      setStartDate(selected);
      if (endDate < selected) setEndDate(selected);
    } else {
      setEndDate(selected);
    }
  };

  const handleCreate = async () => {
    if (!valid) return;
    setCreating(true);
    try {
      await createChallenge(trimmedName, toLocalDateString(startDate), toLocalDateString(endDate));
      router.back();
    } catch (err: any) {
      Alert.alert('Could not create challenge', err.message ?? 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Challenge name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Office Step War"
        maxLength={60}
        autoFocus
      />

      <Text style={styles.label}>Start date</Text>
      <Pressable style={styles.dateRow} onPress={() => setActivePicker('start')}>
        <Text style={styles.dateText}>{startDate.toDateString()}</Text>
      </Pressable>

      <Text style={styles.label}>End date</Text>
      <Pressable style={styles.dateRow} onPress={() => setActivePicker('end')}>
        <Text style={styles.dateText}>{endDate.toDateString()}</Text>
      </Pressable>

      {activePicker && (
        <View>
          <DateTimePicker
            value={activePicker === 'start' ? startDate : endDate}
            mode="date"
            minimumDate={activePicker === 'end' ? startDate : undefined}
            onChange={handlePickerChange}
          />
          <Pressable onPress={() => setActivePicker(null)}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.button, (!valid || creating) && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={!valid || creating}
      >
        <Text style={styles.buttonText}>{creating ? 'Creating…' : 'Create'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  dateRow: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007aff',
    textAlign: 'right',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
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
