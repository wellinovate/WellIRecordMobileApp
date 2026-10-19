import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

const SECTIONS = [
  {
    heading: 'Information We Collect',
    body: 'WelliRecord stores the health records you or your care team add — lab results, prescriptions, imaging, and clinical notes — along with basic profile details like your name, date of birth, blood type, and emergency contact. If you connect a wearable, we also store the vitals it reports.',
  },
  {
    heading: 'How We Use Your Information',
    body: 'Your data is used solely to provide and improve the WelliRecord service for you and the family members on your account. We never sell your data, use it for advertising, or share it with third parties without your explicit permission.',
  },
  {
    heading: 'Your location',
    body: 'If you allow location, the lab and pharmacy locators send your position to our server, which asks Google Places for places near you. We do not store your position. If you do not allow it, the locators show Abuja.',
  },
  {
    heading: 'The Assistant',
    body: 'When you type a question to the Assistant, the conversation is sent to an AI service to write the answer. The Assistant cannot see your records or account, and we do not send them. Do not type personal health details, ID numbers, passwords or codes that you do not want processed. The Assistant gives general information and is not a doctor. In an emergency, call 112.',
  },
  {
    heading: 'Sharing and Smart Consent',
    body: 'When you share a record with a provider or facility, we generate a time-limited grant that you can revoke at any time. You choose exactly which categories or records are shared.',
  },
  {
    heading: 'Security and Encryption',
    body: 'All records are encrypted at rest and in transit. Optional protections — Two-Factor Authentication and Face ID Lock — are available in Privacy & Security and Settings, and are off by default.',
  },
  {
    heading: 'Your Rights & Data Portability',
    body: 'You can download a full copy of your data at any time from Privacy & Security. You can delete your account yourself in Profile, Privacy & security, Delete account. Deletion is immediate. If you cannot open the app, email privacy@wellirecord.com.',
  },
  {
    heading: 'Contact Us',
    body: 'Questions about this policy or your data can be sent to privacy@wellirecord.com.',
  },
];

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
