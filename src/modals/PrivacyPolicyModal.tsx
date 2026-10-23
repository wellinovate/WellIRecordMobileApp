import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';
import { LEGAL_DOCS } from '../data/legalDocs';

const SECTIONS = LEGAL_DOCS.privacy.sections;


export function PrivacyPolicyModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showPrivacyPolicy) return null;

  return (
    <Modal
      visible={state.showPrivacyPolicy}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closePrivacyPolicy}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Privacy Policy"
          onClose={actions.closePrivacyPolicy}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <Text style={styles.updatedText}>Last updated August 2026</Text>
          {SECTIONS.map((s) => (
            <View key={s.heading} style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>{s.heading}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  updatedText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 18,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 21,
  },
});
