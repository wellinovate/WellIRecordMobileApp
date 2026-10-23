import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';
import { LegalDocViewer } from '../../../components/LegalDocViewer';
import { LEGAL_EFFECTIVE_DATE, REQUIRED_DOCS, type LegalDoc, type LegalDocId } from '../../../data/legalDocs';

const NAVY = '#012353';
const TEAL = '#0F766E';

/** Shown to a new person before registration. Each required document needs its own tick. */
export function LegalScreen({ onContinue, onLogIn }: { onContinue: () => void | Promise<void>; onLogIn: () => void }) {
  const [ticked, setTicked] = useState<Partial<Record<LegalDocId, boolean>>>({});
  const [reading, setReading] = useState<LegalDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const all = REQUIRED_DOCS.every((d) => ticked[d.id]);

  const go = async () => {
    if (!all || busy) return;
    setBusy(true);
    try {
      await onContinue();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <LogoMark size={40} shieldColor={NAVY} />
          <Text style={s.wordmark}>WELLIRECORD<Text style={s.tm}>™</Text></Text>
        </View>

        <Text style={s.title} accessibilityRole="header">Before you get started</Text>
        <Text style={s.intro}>
          Please review our legal documents before creating your account. They explain how your account, personal information, and health records are protected and used.
        </Text>
        <Text style={s.date}>{`Effective date: ${LEGAL_EFFECTIVE_DATE}`}</Text>

        {REQUIRED_DOCS.map((doc) => {
          const on = Boolean(ticked[doc.id]);
          return (
            <View key={doc.id} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{doc.title}</Text>
                <Text style={s.required}>Required</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={doc.agreeLabel}
                activeOpacity={0.7}
                onPress={() => setTicked((t) => ({ ...t, [doc.id]: !t[doc.id] }))}
                style={s.row}
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Read the ${doc.title}`} onPress={() => setReading(doc)} style={s.read}>
                <Text style={s.readText}>Read the full document</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={s.note}>Your agreement will be recorded with the relevant document version and acceptance time.</Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !all || busy }}
          onPress={go}
          disabled={!all || busy}
          style={[s.primary, (!all || busy) && { opacity: 0.45 }]}
        >
          <Text style={s.primaryText}>Continue to registration</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" onPress={onLogIn} style={s.login}>
          <Text style={s.loginText}>Already have an account? <Text style={s.loginLink}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>

      <LegalDocViewer doc={reading} onClose={() => setReading(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 24, paddingBottom: 32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  wordmark: { color: NAVY, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  tm: { fontSize: 7 },
  title: { color: NAVY, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  intro: { marginTop: 10, color: '#475569', fontSize: 15, lineHeight: 22 },
  date: { marginTop: 10, color: TEAL, fontSize: 13.5, fontWeight: '600' },
  card: { marginTop: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, backgroundColor: '#F8FAFC' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, color: NAVY, fontSize: 15, fontWeight: '800' },
  required: { color: '#B45309', fontSize: 11.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 12, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: TEAL, borderColor: TEAL },
  agree: { flex: 1, color: '#1E293B', fontSize: 14, lineHeight: 20 },
  read: { marginTop: 4, minHeight: 40, justifyContent: 'center' },
  readText: { color: TEAL, fontSize: 14, fontWeight: '700' },
  note: { marginTop: 16, color: '#64748B', fontSize: 12.5, lineHeight: 18 },
  primary: { marginTop: 20, minHeight: 54, borderRadius: 14, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  login: { marginTop: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: '#475569', fontSize: 14 },
  loginLink: { color: TEAL, fontWeight: '800' },
});
