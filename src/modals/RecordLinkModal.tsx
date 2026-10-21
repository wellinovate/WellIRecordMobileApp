import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { parseRecordLink } from '../utils/recordLink';
import { recordLinkStatusText } from '../utils/webLink';
import { webLinkService, type RecordLinkItem } from '../services/webLinkService';
import { RecordLinkFlow } from './RecordLinkFlow';
import type { WelliApp } from '../state/useWelliApp';

/**
 * "Your hospital wants to link your records." With the website account linked (Profile > Website account) the steps
 * run here in the app through the signed bridge. Without it, the page opens on the website, as before.
 */
export function RecordLinkModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mine, setMine] = useState<RecordLinkItem[]>([]);
  const visible = state.showRecordLink;

  const loadMine = () => webLinkService.recordLinks().then(setMine).catch(() => setMine([]));

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    webLinkService
      .status()
      .then((s) => {
        if (!alive) return;
        setLinked(Boolean(s.linked));
        if (s.linked) loadMine();
      })
      .catch(() => alive && setLinked(false));
    return () => {
      alive = false;
    };
  }, [visible]);

  if (!visible) return null;

  const close = () => {
    setText('');
    setError(null);
    setToken(null);
    actions.closeRecordLink();
  };

  const open = async () => {
    const parsed = parseRecordLink(text);
    if (!parsed) {
      setError('That is not a WelliRecord link. Paste the link from the text message your hospital sent, or the code at the end of it.');
      return;
    }
    setError(null);
    if (linked) {
      setToken(parsed.token);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(parsed.url);
    } catch {
      setError('Could not open the page. Try again, or open the link from your messages.');
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Link hospital records" onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.body, { color: theme.text }]}>
            If a hospital that holds your records on paper or in its own system asks you to link them, it sends a link by text message. Opening it starts these steps:
          </Text>
          <Text style={[styles.step, { color: theme.text }]}>1. Check your identity with a code sent to the phone number the hospital has for you.</Text>
          <Text style={[styles.step, { color: theme.text }]}>2. Choose what the hospital may add: personal details, allergies, medications.</Text>
          <Text style={[styles.step, { color: theme.text }]}>3. The hospital checks and releases it. Nothing is added before that.</Text>

          <Text style={[styles.label, { color: theme.muted }]}>LINK OR CODE FROM THE TEXT MESSAGE</Text>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            placeholder="https://www.wellirecord.com/join/..."
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity onPress={open} accessibilityRole="button" style={styles.btn}>
            <Text style={styles.btnText}>{linked ? 'Continue' : 'Continue on the WelliRecord website'}</Text>
          </TouchableOpacity>

          {linked && token ? <RecordLinkFlow token={token} onChanged={loadMine} /> : null}

          {linked && mine.length > 0 ? (
            <>
              <Text style={[styles.label, { color: theme.muted }]}>YOUR LINKS</Text>
              {mine.map((l) => (
                <Text key={l.id} style={[styles.step, { color: theme.text }]}>
                  {l.organization || 'Hospital'}: {recordLinkStatusText(l.status)}
                </Text>
              ))}
            </>
          ) : null}

          {!linked ? (
            <>
              <Text style={[styles.note, { color: theme.muted }]}>
                The steps open in your browser, and the records are filed to your WelliRecord website account. To do them here in the app instead, link your website account.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  close();
                  actions.openWebLink();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.note, { color: theme.text, textDecorationLine: 'underline' }]}>Link my website account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.note, { color: theme.muted }]}>The records are filed to your linked WelliRecord website account.</Text>
          )}
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
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  error: { color: '#B91C1C', fontSize: 13 },
  btn: { backgroundColor: '#082F67', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
