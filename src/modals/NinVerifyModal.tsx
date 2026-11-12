import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { formatNin, isNin } from '../utils/nin';
import { ninService, type NinStatus } from '../services/ninService';
import type { WelliApp } from '../state/useWelliApp';

/** Confirm identity with a National Identity Number. The number is checked once and never saved by WelliRecord. */
export function NinVerifyModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [status, setStatus] = useState<NinStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [nin, setNin] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = state.showNinVerify;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await ninService.status());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your status. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const close = () => {
    setNin('');
    setAgree(false);
    setError(null);
    actions.closeNinVerify();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ninService.verify(nin);
      setNin('');
      setAgree(false);
      await load();
      actions.showToast('Identity confirmed');
    } catch (e: any) {
      setError(e?.message || 'Could not complete the check. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const ready = isNin(nin) && agree && !busy;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Identity check" onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loading && !status ? <ActivityIndicator color={theme.muted} /> : null}

          {status?.verified ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Identity confirmed</Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                Your name and date of birth matched your NIN record
                {status.verifiedAt ? ` on ${new Date(status.verifiedAt).toLocaleDateString()}` : ''}.
              </Text>
            </>
          ) : null}

          {status && !status.verified && !status.available ? (
            <Text style={[styles.body, { color: theme.text }]}>The identity check is not switched on yet.</Text>
          ) : null}

          {status && !status.verified && status.available ? (
            <>
              <Text style={[styles.body, { color: theme.text }]}>
                Confirm that you are the person on this account. We compare the name and date of birth on your NIN record with your WelliRecord profile.
              </Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                Check your full name and date of birth in Personal information first. They must match your NIN record.
              </Text>
              <Text style={[styles.label, { color: theme.muted }]}>NIN (11 digits)</Text>
              <TextInput
                value={nin}
                onChangeText={(v) => {
                  setNin(formatNin(v));
                  setError(null);
                }}
                placeholder="12345678901"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                autoCorrect={false}
                autoComplete="off"
                maxLength={11}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              />
              <TouchableOpacity
                onPress={() => setAgree(!agree)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agree }}
                style={styles.consent}
              >
                <View style={[styles.box, { borderColor: theme.border }, agree && styles.boxOn]}>
                  {agree ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <Text style={[styles.consentText, { color: theme.text }]}>
                  I agree that WelliRecord sends my NIN to 2AM Connect, which checks it with the National Identity Management Commission. WelliRecord keeps the result, not the number.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} disabled={!ready} accessibilityRole="button" style={[styles.btn, !ready && styles.off]}>
                <Text style={styles.btnText}>{busy ? 'Checking…' : 'Check my identity'}</Text>
              </TouchableOpacity>
              <Text style={[styles.note, { color: theme.muted }]}>
                You have 3 tries a day. The NIN record is read only to compare your name and date of birth. Nothing else from it is kept.
              </Text>
            </>
          ) : null}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 14, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 18, letterSpacing: 2 },
  consent: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: '#082F67', borderColor: '#082F67' },
  tick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  consentText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  error: { color: '#B91C1C', fontSize: 13 },
  btn: { backgroundColor: '#082F67', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  off: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
