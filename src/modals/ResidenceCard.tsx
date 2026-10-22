import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FormSelect } from '../components/FormSelect';
import { STATE_NAMES } from '../data/nigeriaRegions';
import { profileService } from '../services/profileService';
import { hapticFeedback } from '../utils/haptics';

// Where the person lives now. Changing it never changes their WelliID or the region they registered in.
export function ResidenceCard({ onSaved }: { onSaved?: (msg: string) => void }) {
  const [saved, setSaved] = useState('');
  const [value, setValue] = useState('');
  const [registered, setRegistered] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    profileService.fetchMyProfile().then((p) => {
      if (!live || !p) return;
      setSaved(p.residenceState || '');
      setValue(p.residenceState || '');
      setRegistered(p.registrationState || '');
    });
    return () => {
      live = false;
    };
  }, []);

  const changed = value !== '' && value !== saved;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await profileService.setResidence(value);
      setSaved(r.residenceState);
      hapticFeedback.success();
      onSaved?.('Your state was updated. Your WelliID did not change.');
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Where you live</Text>
      <FormSelect value={value} onChange={setValue} options={STATE_NAMES} placeholder="Select your state" />
      <Text style={styles.note}>
        {registered ? `Your WelliID was issued when you registered in ${registered}. ` : ''}
        Moving does not change it.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {changed ? (
        <TouchableOpacity style={styles.btn} onPress={save} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save state</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  note: { fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 17 },
  error: { fontSize: 12.5, color: '#B91C1C', marginTop: 8 },
  btn: { marginTop: 12, backgroundColor: '#041E42', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
