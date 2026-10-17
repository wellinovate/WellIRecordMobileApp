import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { childHealthService, type ReminderState } from '../services/childHealthService';
import { ApiError } from '../services/apiClient';

const KIND_LABEL = { due_soon: 'due in the next 2 weeks', due: 'due now', overdue: 'past the usual window' } as const;

/**
 * Vaccine reminders for the signed-in guardian. Settings are per guardian.
 * SMS and WhatsApp need a Nigerian mobile number and the guardian's consent,
 * which is recorded when the switch is turned on.
 */
export function ChildReminderCard({ memberId, toast }: { memberId: string; toast: (m: string) => void }) {
  const theme = useTheme();
  const [state, setState] = useState<ReminderState | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await childHealthService.fetchReminders(memberId);
      setState(data);
      setPush(data.preferences.push);
      setSms(data.preferences.sms);
      setWhatsapp(data.preferences.whatsapp);
      setPhone(data.preferences.phone || '');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) setHidden(true);
      else setError(err instanceof Error ? err.message : 'Could not load reminder settings.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden) return null;

  const dirty =
    !!state &&
    (push !== state.preferences.push ||
      sms !== state.preferences.sms ||
      whatsapp !== state.preferences.whatsapp ||
      phone.trim() !== (state.preferences.phone || ''));
  const needsPhone = (sms || whatsapp) && !phone.trim();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const prefs = await childHealthService.saveReminders(memberId, { push, sms, whatsapp, phone: phone.trim() });
      setState((s) => (s ? { ...s, preferences: prefs } : s));
      toast('Reminder settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save reminder settings.');
    } finally {
      setBusy(false);
    }
  };

  const row = (title: string, hint: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled || busy} accessibilityLabel={title} />
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.heading, { color: theme.text }]}>Vaccine reminders</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>
        These settings are yours. Other guardians choose their own. Reminders follow the schedule in the app, which is still waiting for clinical review, so treat them as prompts to check with the clinic.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : state ? (
        <>
          {state.upcoming.length > 0 && (
            <Text style={[styles.hint, { color: theme.text, marginTop: 8 }]}>
              Right now: {state.upcoming.map((u) => `${u.count} ${u.count === 1 ? 'dose' : 'doses'} ${KIND_LABEL[u.kind]}`).join(', ')}.
            </Text>
          )}
          {row('Notifications on this phone', 'Sent to the app.', push, setPush)}
          {row(
            'SMS',
            state.availability.sms ? 'Text message to the number below.' : 'Not switched on yet. The service is not set up.',
            sms && state.availability.sms,
            setSms,
            !state.availability.sms,
          )}
          {row(
            'WhatsApp',
            state.availability.whatsapp ? 'WhatsApp message to the number below.' : 'Not switched on yet. The service is not approved.',
            whatsapp && state.availability.whatsapp,
            setWhatsapp,
            !state.availability.whatsapp,
          )}
          {(state.availability.sms || state.availability.whatsapp) && (
            <View style={{ marginTop: 6 }}>
              <Text style={[styles.label, { color: theme.muted }]}>NIGERIAN MOBILE NUMBER</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="0803 123 4567"
                placeholderTextColor={theme.mutedLight}
                keyboardType="phone-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              />
              <Text style={[styles.hint, { color: theme.muted }]}>
                By turning on SMS or WhatsApp you agree to get vaccine reminders about this child on this number. Messages are sent between 8am and 8pm. You can turn them off here at any time. Each message has the child's name and how many doses are due. It does not name vaccines or any diagnosis.
              </Text>
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {needsPhone && <Text style={styles.error}>Enter a mobile number to use SMS or WhatsApp.</Text>}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!dirty || busy || needsPhone}
            onPress={save}
            style={[styles.btn, (!dirty || busy || needsPhone) && { opacity: 0.5 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save reminder settings</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.btnAlt}>
            <Text style={styles.btnAltText}>Try again</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 46, marginBottom: 6 },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 6 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
});
