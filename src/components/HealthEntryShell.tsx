import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from './ActivityModal';

export const ACCENT = '#315B90';

/** Full-screen frame shared by the three Health information screens. */
export function HealthEntryShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={h.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={h.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={h.close}>
              <Text style={{ fontSize: 20, color: '#173B68' }}>‹</Text>
            </TouchableOpacity>
            <Text style={h.title}>{title}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={h.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export const h = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  title: { fontSize: 18, fontWeight: '800', color: '#082F67', flex: 1, textAlign: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  intro: { fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  last: { fontSize: 12, color: '#047857', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: '#fff' },
  select: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { fontSize: 16, color: '#111827' },
  placeholder: { fontSize: 16, color: '#9AA3AF' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  primary: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#4B5563', marginTop: 3 },
  remove: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6 },
  removeText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  err: { color: '#b91c1c', marginTop: 8, fontSize: 14 },
  ok: { color: '#047857', fontWeight: '700', marginTop: 8, fontSize: 14 },
  section: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 8 },
});
