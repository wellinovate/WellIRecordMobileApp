import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../services/authService';
import type { WelliApp } from '../state/useWelliApp';

const ACCENT = '#315B90';
type Kind = 'email' | 'phone';
interface Status { email: string | null; emailVerified: boolean; phone: string | null; phoneVerified: boolean }

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/**
 * Profile > Email & phone verification. Shows the email and phone on the account and whether each was proven
 * with a code. A new one is confirmed by a 6-digit code sent to it before the account changes.
 * Always mounted; every hook runs before the early return.
 */
export function ContactVerificationModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const open = state.showContactVerify;
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Kind | null>(null);
  const [value, setValue] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    authService
      .contactStatus()
      .then((s) => { if (live) { setStatus(s); setLoadError(null); } })
      .catch((e) => { if (live) setLoadError(messageOf(e, 'Could not load your details. Check your connection.')); });
    return () => { live = false; };
  }, [open]);

  if (!open) return null;

  const reset = () => { setEditing(null); setValue(''); setCode(''); setCodeSent(false); setError(null); };
  const begin = (kind: Kind, current: string | null) => { reset(); setDone(null); setEditing(kind); setValue(kind === 'email' ? current ?? '' : ''); };
  const close = () => { reset(); setDone(null); actions.closeContactVerify(); };

  const send = async () => {
    if (!editing || busy) return;
    setBusy(true); setError(null);
    try { await authService.sendContactCode(editing, value.trim()); setCodeSent(true); setCode(''); }
    catch (e) { setError(messageOf(e, 'Could not send a code. Try again.')); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!editing || busy || code.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const saved = await authService.verifyContactCode(editing, value.trim(), code);
      actions.contactChanged(editing, saved);
      setStatus((s) => (s ? (editing === 'email' ? { ...s, email: saved, emailVerified: true } : { ...s, phone: saved, phoneVerified: true }) : s));
      setDone(editing === 'email' ? 'Email confirmed.' : 'Phone number confirmed.');
      reset();
    } catch (e) { setCode(''); setError(messageOf(e, 'That code did not work. Try again.')); }
    finally { setBusy(false); }
  };

  const card = (kind: Kind, title: string, current: string | null, verified: boolean) => {
    const active = editing === kind;
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.current}>{current || 'Not set'}</Text>
        {current ? (
          <Text style={[s.badge, { color: verified ? '#047857' : '#b45309' }]}>{verified ? 'Verified' : 'Not verified yet'}</Text>
        ) : null}
        {!active ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => begin(kind, current)} style={s.secondary}>
            <Text style={s.secondaryText}>{!current ? 'Add' : verified ? 'Change' : 'Verify'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 12 }}>
            {!codeSent ? (
              <>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={kind === 'email' ? 'email-address' : 'phone-pad'}
                  placeholder={kind === 'email' ? 'name@example.com' : '08012345678'}
                  placeholderTextColor="#9AA3AF"
                  accessibilityLabel={kind === 'email' ? 'Email address' : 'Phone number'}
                  style={s.input}
                />
                <TouchableOpacity accessibilityRole="button" disabled={busy || value.trim().length < 5} onPress={send} style={[s.primary, (busy || value.trim().length < 5) && { opacity: 0.5 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Send code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.hint}>We sent a 6-digit code to {value.trim()}.</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  placeholder="123456"
                  placeholderTextColor="#9AA3AF"
                  accessibilityLabel="Verification code"
                  style={[s.input, { fontSize: 22, letterSpacing: 4 }]}
                  onSubmitEditing={confirm}
                />
                <TouchableOpacity accessibilityRole="button" disabled={busy || code.length !== 6} onPress={confirm} style={[s.primary, (busy || code.length !== 6) && { opacity: 0.5 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Confirm</Text>}
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={send} style={s.link}>
                  <Text style={s.linkText}>Send a new code</Text>
                </TouchableOpacity>
              </>
            )}
            {error ? <Text style={s.err} accessibilityLiveRegion="polite">{error}</Text> : null}
            <TouchableOpacity accessibilityRole="button" onPress={reset} style={s.link}>
              <Text style={[s.linkText, { color: '#6B7280' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.header}>
            <Text style={s.title}>Email & phone verification</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={s.close}>
              <Text style={{ fontSize: 18, color: '#173B68' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.sub}>
              A new email or number is saved only after you enter the code we send to it. We use them for sign-in codes, appointment notices and the app unlock code.
            </Text>
            {done ? <Text style={s.ok} accessibilityLiveRegion="polite">{done}</Text> : null}
            {loadError ? <Text style={s.err}>{loadError}</Text> : null}
            {!status && !loadError ? <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} /> : null}
            {status ? card('email', 'Email', status.email, status.emailVerified) : null}
            {status ? card('phone', 'Phone number', status.phone, status.phoneVerified) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  title: { fontSize: 18, fontWeight: '800', color: '#082F67', flex: 1, paddingRight: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 16 },
  card: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  current: { fontSize: 17, fontWeight: '600', color: '#111827', marginTop: 6 },
  badge: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827' },
  hint: { fontSize: 13, color: '#4B5563', marginBottom: 10 },
  primary: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12, minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: ACCENT, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  secondaryText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  link: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  err: { color: '#b91c1c', marginTop: 10, fontSize: 14 },
  ok: { color: '#047857', fontWeight: '700', marginBottom: 12, fontSize: 14 },
});
