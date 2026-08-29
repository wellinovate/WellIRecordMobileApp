import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { formatDob } from '../utils/formatDate';
import type { WelliApp } from '../state/useWelliApp';

export function EmergencyModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showEmergency) return null;

  const emergencyMember =
    family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isDependent = emergencyMember.role === 'dependent';
  const guardianLine = isDependent ? `Guardian: ${family[0].name}` : null;

  return (
    <Modal
      visible={state.showEmergency}
      animationType="fade"
      transparent={false}
      onRequestClose={actions.closeEmergency}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Emergency Medical ID"
          dark
          onClose={actions.closeEmergency}
          onBack={actions.closeEmergency}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {/* Main ID Card */}
          <LinearGradient
            colors={['#020617', '#1e3a8a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.idCard}
          >
            <View style={styles.badgeRow}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.idCardBadgeText}>Emergency Medical ID</Text>
            </View>

            <Text style={styles.memberName}>{emergencyMember.name}</Text>
            <Text style={styles.dobText}>DOB: {formatDob(emergencyMember.dob)}</Text>
            {guardianLine ? (
              <Text style={styles.guardianText}>{guardianLine}</Text>
            ) : null}

            <View style={styles.gridTwo}>
              <View>
                <Text style={styles.fieldLabel}>Blood Type</Text>
                <Text style={styles.fieldValue}>{emergencyMember.bloodType}</Text>
              </View>
              <View>
                <Text style={styles.fieldLabel}>Genotype</Text>
                <Text style={styles.fieldValue}>{emergencyMember.genotype}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Allergies</Text>
              <Text style={styles.fieldValue}>{emergencyMember.allergies}</Text>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Conditions</Text>
              <Text style={styles.fieldValue}>{emergencyMember.conditions}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Emergency Contact</Text>
              <Text style={styles.contactValue}>{emergencyMember.contact}</Text>
            </View>
          </LinearGradient>

          {/* First Responders QR Box */}
          <View style={styles.qrCard}>
            <QRCode
              value={`https://welli.link/emergency/${emergencyMember.id}`}
              size={140}
              color="#0f172a"
              backgroundColor="#ffffff"
            />
            <Text style={styles.qrCaption}>
              First responders can scan for full profile
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050d1a',
  },
  closeHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20,
  },
  idCard: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
    elevation: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  idCardBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  memberName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  dobText: {
    color: '#93a5c9',
    fontSize: 13,
    marginBottom: 6,
  },
  guardianText: {
    color: '#fbbf24',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 16,
  },
  gridTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#6b87b3',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
    fontWeight: '600',
  },
  fieldValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 10,
  },
  contactValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  qrCaption: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});
