import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FormSelect } from '../components/FormSelect';
import { LegalDocViewer } from '../components/LegalDocViewer';
import { STATE_NAMES } from '../data/nigeriaRegions';
import { REQUIRED_DOCS, type LegalDoc, type LegalDocId } from '../data/legalDocs';
import type { WelliApp } from '../state/useWelliApp';

/**
 * A new Google or Apple account must choose a state, and accept the legal documents if that has not
 * happened yet, before it is created. The state sets the WelliID. Always mounted; hooks run before
 * the early return.
 */
export function SocialStateModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [value, setValue] = useState('');
  const [ticked, setTicked] = useState<Partial<Record<LegalDocId, boolean>>>({});
  const [reading, setReading] = useState<LegalDoc | null>(null);
  const pending = state.socialState;
  if (!pending) return null;

  const legalOk = !pending.needLegal || REQUIRED_DOCS.every((d) => ticked[d.id]);
  const stateOk = !pending.needState || Boolean(value);
  const ready = legalOk && stateOk && !pending.busy;

  return (
    <Modal visible animationType="fade" onRequestClose={actions.cancelSocialState}>
      <SafeAreaView style={s.screen}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.title} accessibilityRole="header">One more step</Text>
          <Text style={s.sub}>
            {pending.needState ? 'Your state sets your WelliID when you create your account. The ID does not change if you move later.' : 'Please review and accept before your account is created.'}
          </Text>
          {pending.needState ? <FormSelect value={value} onChange={setValue} options={STATE_NAMES} placeholder="Select your state" /> : null}

          {pending.needLegal
            ? REQUIRED_DOCS.map((doc) => {
                const on = Boolean(ticked[doc.id]);
                return (
                  <View key={doc.id} style={s.docRow}>
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={doc.agreeLabel}
                      onPress={() => setTicked((t) => ({ ...t, [doc.id]: !t[doc.id] }))}
                      style={s.check}
                    >
                      <View style={[s.box, on && s.boxOn]}>
                        {on ? (
                          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <Path d="M5 12.5L9.5 17L19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        ) : null}
                      </View>
                      <Text style={s.agree}>{doc.agreeLabel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" onPress={() => setReading(doc)} style={s.read}>
                      <Text style={s.readText}>Read the full document</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            : null}

          {pending.error ? <Text style={s.err} accessibilityLiveRegion="polite">{pending.error}</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!ready}
            onPress={() => void actions.submitSocialState(value, legalOk)}
            style={[s.primary, !ready && { opacity: 0.5 }]}
          >
            {pending.busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={actions.cancelSocialState} style={s.link}>
            <Text style={s.linkText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
        <LegalDocViewer doc={reading} onClose={() => setReading(null)} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  body: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 14, color: '#475569', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  docRow: { marginTop: 18 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: '#fff' },
  boxOn: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  agree: { flex: 1, color: '#1E293B', fontSize: 14, lineHeight: 20 },
  read: { marginLeft: 36, minHeight: 36, justifyContent: 'center' },
  readText: { color: '#0F766E', fontSize: 14, fontWeight: '700' },
  err: { color: '#b91c1c', fontSize: 13, marginTop: 10 },
  primary: { backgroundColor: '#012353', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: '#315B90', fontWeight: '600' },
});
