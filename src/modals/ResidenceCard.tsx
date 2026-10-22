import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FormSelect } from '../components/FormSelect';
import { STATE_NAMES } from '../data/nigeriaRegions';
import { profileService } from '../services/profileService';
import { hapticFeedback } from '../utils/haptics';

// Where the person lives now. Changing it never changes their WelliID or the region they registered in.
export function ResidenceCard({ onSaved }: { onSaved?: (msg: string) => void }) {
  const [saved, setSaved] = useState('');
  const [value, setValue] = useState('');
  const [registered, setRegistered] = useState('');
  const [lgaSaved, setLgaSaved] = useState('');
  const [lgaText, setLgaText] = useState('');
  const [lgaCode, setLgaCode] = useState('');
  const [lgaList, setLgaList] = useState<{ code: string; name: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    profileService.fetchMyProfile().then((p) => {
      if (!live || !p) return;
      setSaved(p.residenceState || '');
      setValue(p.residenceState || '');
      setRegistered(p.registrationState || '');
      setLgaSaved(`${p.lgaCode || ''}|${p.lgaText || p.residenceLga || ''}`);
      setLgaText(p.lgaText || p.residenceLga || '');
      setLgaCode(p.lgaCode || '');
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!value) return;
    let live = true;
    profileService.listLgas(value).then((l) => live && setLgaList(l));
    return () => {
      live = false;
    };
  }, [value]);

  const NOT_LISTED = 'Not listed, type it';
  const hasList = lgaList.length > 0;
  const showTyped = typing || !hasList;
  const changed = value !== '' && (value !== saved || `${lgaCode}|${lgaText}` !== lgaSaved);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await profileService.setResidence(value, lgaText, lgaCode);
      setSaved(r.residenceState);
      setLgaSaved(`${r.lgaCode}|${r.residenceLga}`);
      setLgaCode(r.lgaCode);
      hapticFeedback.success();
      onSaved?.('Your location was updated. Your WelliID did not change.');
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Where you live</Text>
      <FormSelect
        value={value}
        onChange={(v) => {
          setValue(v);
          setLgaText('');
          setLgaCode('');
          setTyping(false);
        }}
        options={STATE_NAMES}
        placeholder="Select your state"
      />
      {value ? (
        <View style={{ marginTop: 8 }}>
          {hasList ? (
            <FormSelect
              value={typing ? NOT_LISTED : lgaList.find((l) => l.code === lgaCode)?.name}
              onChange={(v) => {
                if (v === NOT_LISTED) {
                  setTyping(true);
                  setLgaCode('');
                  return;
                }
                const hit = lgaList.find((l) => l.name === v);
                setTyping(false);
                setLgaCode(hit?.code || '');
                setLgaText(hit?.name || '');
              }}
              options={[...lgaList.map((l) => l.name), NOT_LISTED]}
              placeholder="Local government or area council"
            />
          ) : null}
          {showTyped ? (
            <TextInput
              style={styles.input}
              value={lgaText}
              onChangeText={(t) => {
                setLgaText(t);
                setLgaCode('');
              }}
              maxLength={60}
              placeholder="Local government or area council (optional)"
              placeholderTextColor="#94A3B8"
            />
          ) : null}
        </View>
      ) : null}
      <Text style={styles.note}>
        {registered ? `Your WelliID was issued when you registered in ${registered}. ` : ''}
        Moving does not change it.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {changed ? (
        <TouchableOpacity style={styles.btn} onPress={save} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  input: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  note: { fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 17 },
  error: { fontSize: 12.5, color: '#B91C1C', marginTop: 8 },
  btn: { marginTop: 12, backgroundColor: '#041E42', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
