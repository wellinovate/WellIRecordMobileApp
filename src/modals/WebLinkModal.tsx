import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { formatLinkCode, isLinkCode } from '../utils/webLink';
import { webLinkService, type WebLinkStatus } from '../services/webLinkService';
import type { WelliApp } from '../state/useWelliApp';

/** Link this app account to the same person's WelliRecord website account. */
export function WebLinkModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [status, setStatus] = useState<WebLinkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = state.showWebLink;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await webLinkService.status();
      setStatus({ available: s.available, linked: s.linked, fullName: s.fullName, linkedAt: s.linkedAt });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not check the link. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const close = () => {
    setCode('');
    setError(null);
    actions.closeWebLink();
  };

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      await webLinkService.claim(code);
      setCode('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not link. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = () =>
    Alert.alert('Unlink website account?', 'Website video visits and hospital record links will stop showing in this app. Nothing is deleted from either account.', [
      { text: 'Keep it linked', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await webLinkService.unlink();
            await load();
          } catch (e: any) {
            setError(e?.message || 'Could not unlink. Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Website account" onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loading && !status ? <ActivityIndicator color={theme.muted} /> : null}

          {status && !status.available ? (
            <Text style={[styles.body, { color: theme.text }]}>Linking your website account is not switched on yet.</Text>
          ) : null}

          {status?.available && status.linked ? (
            <>
              <Text style={[styles.body, { color: theme.text }]}>
                Linked{status.fullName ? ` to ${status.fullName}` : ''} on the WelliRecord website.
              </Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                You can join video visits booked on the website from Upcoming visits, and finish hospital record links here in the app.
              </Text>
              <TouchableOpacity onPress={unlink} disabled={busy} accessibilityRole="button" style={[styles.btn, styles.danger]}>
                <Text style={styles.btnText}>{busy ? 'Working…' : 'Unlink website account'}</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {status?.available && !status.linked ? (
            <>
              <Text style={[styles.body, { color: theme.text }]}>
                If you also use WelliRecord on the website, link the two accounts. Then video visits booked on the website show in this app, and you can finish hospital record links here.
              </Text>
              <Text style={[styles.step, { color: theme.text }]}>1. Sign in on the website and open Settings, then Mobile app.</Text>
              <Text style={[styles.step, { color: theme.text }]}>2. Choose "Make a link code". It works for 10 minutes.</Text>
              <Text style={[styles.step, { color: theme.text }]}>3. Type the code below.</Text>
              <Text style={[styles.label, { color: theme.muted }]}>LINK CODE</Text>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(formatLinkCode(v));
                  setError(null);
                }}
                placeholder="ABCD-2345"
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              />
              <TouchableOpacity
                onPress={link}
                disabled={busy || !isLinkCode(code)}
                accessibilityRole="button"
                style={[styles.btn, (busy || !isLinkCode(code)) && styles.off]}
              >
                <Text style={styles.btnText}>{busy ? 'Linking…' : 'Link account'}</Text>
              </TouchableOpacity>
              <Text style={[styles.note, { color: theme.muted }]}>
                Only link your own account. Linking lets this app read your website video visits and finish hospital record links for you. It does not copy your records between the two.
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
  body: { fontSize: 15, lineHeight: 22 },
  step: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 14, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 18, letterSpacing: 2 },
  error: { color: '#B91C1C', fontSize: 13 },
  btn: { backgroundColor: '#082F67', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  danger: { backgroundColor: '#b91c1c' },
  off: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
