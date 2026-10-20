import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { securityService, type AuditEntry, type AuditKind } from '../services/securityService';
import type { WelliApp } from '../state/useWelliApp';

const ACCENT = '#315B90';
const TABS: { key: AuditKind; label: string; intro: string; empty: string }[] = [
  { key: 'access', label: 'Who accessed my record', intro: 'Every time a provider link is created, opened or withdrawn, and every emergency card scan. Your own reading of your own record is not listed.', empty: 'No one but you has accessed your record.' },
  { key: 'security', label: 'Sign-in and security', intro: 'Sign-ins, changes to your second step, password resets and sign-outs of other devices. If you see something you do not recognise, change your password and sign out other devices.', empty: 'Nothing recorded yet.' },
];

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The signed-in person's own security and access log, read from the server. */
export function AccountLogModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [tab, setTab] = useState<AuditKind>('access');
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(async (kind: AuditKind, before?: string) => {
    try {
      setError(null);
      const r = await securityService.auditLog(kind, before);
      setEntries((cur) => (before && cur ? [...cur, ...r.entries] : r.entries));
      setNext(r.nextBefore);
    } catch (e: any) {
      setError(e?.message || 'Could not load your log.');
      setEntries((cur) => cur ?? []);
    } finally {
      setMore(false);
    }
  }, []);

  useEffect(() => {
    if (state.showAccountLog) {
      setEntries(null);
      void load(tab);
    }
  }, [state.showAccountLog, tab, load]);

  if (!state.showAccountLog) return null;
  const cur = TABS.find((t) => t.key === tab)!;

  return (
    <Modal visible animationType="slide" onRequestClose={actions.closeAccountLog}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <ModalHeader title="Security and access log" onClose={actions.closeAccountLog} />
        <View style={st.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => setTab(t.key)} style={[st.tab, { borderColor: ACCENT }, tab === t.key && { backgroundColor: ACCENT }]}>
              <Text style={{ color: tab === t.key ? '#fff' : ACCENT, fontWeight: '700', fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>{cur.intro}</Text>
          {entries === null && <ActivityIndicator style={{ marginTop: 30 }} />}
          {error ? <Text style={{ color: '#b91c1c', marginTop: 12 }}>{error}</Text> : null}
          {entries?.length === 0 && !error ? <Text style={{ color: theme.muted, marginTop: 24, textAlign: 'center' }}>{cur.empty}</Text> : null}
          {entries?.map((e) => (
            <View key={e.id} style={[st.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{e.title}</Text>
              <Text style={{ color: theme.text, fontSize: 13, marginTop: 2 }}>{e.actor}{e.detail ? ` · ${e.detail}` : ''}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                {when(e.at)}{e.device ? ` · ${e.device}` : ''}{e.ip ? ` · ${e.ip}` : ''}
              </Text>
            </View>
          ))}
          {next ? (
            <TouchableOpacity accessibilityRole="button" disabled={more} onPress={() => { setMore(true); void load(tab, next); }} style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: ACCENT, fontWeight: '700' }}>{more ? 'Loading…' : 'Show older'}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10 },
});
