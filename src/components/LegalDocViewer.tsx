import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from './ActivityModal';
import type { LegalDoc } from '../data/legalDocs';
import { LEGAL_EFFECTIVE_DATE } from '../data/legalDocs';

/** Full text of one legal document in a sheet. */
export function LegalDocViewer({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  return (
    <Modal visible={Boolean(doc)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.screen}>
        <View style={s.bar}>
          <Text style={s.barTitle} numberOfLines={1} accessibilityRole="header">{doc?.title ?? ''}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.meta}>{`Effective date: ${LEGAL_EFFECTIVE_DATE}`}</Text>
          {doc?.sections.map((sec) => (
            <View key={sec.heading} style={s.block}>
              <Text style={s.heading}>{sec.heading}</Text>
              <Text style={s.text}>{sec.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  barTitle: { flex: 1, color: '#012353', fontSize: 16, fontWeight: '800', marginRight: 12 },
  close: { color: '#0F766E', fontSize: 15, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  meta: { color: '#64748B', fontSize: 12.5, marginBottom: 8 },
  block: { marginTop: 16 },
  heading: { color: '#012353', fontSize: 15, fontWeight: '800' },
  text: { marginTop: 6, color: '#334155', fontSize: 14, lineHeight: 21 },
});
