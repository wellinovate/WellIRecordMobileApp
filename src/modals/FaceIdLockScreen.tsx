import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Logo } from '../components/Logo';
import {
  getBiometricStatus,
  authenticateWithBiometrics,
  type BiometricStatus,
} from '../utils/biometrics';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function FaceIdLockScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [bioStatus, setBioStatus] = useState<BiometricStatus>({
    isAvailable: false,
    hasHardware: false,
    isEnrolled: false,
    biometryType: 'face',
    label: 'Face ID',
  });
  const [authenticating, setAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getBiometricStatus().then(setBioStatus);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    setErrorMessage(null);
    hapticFeedback.light();

    const result = await authenticateWithBiometrics(
      `Unlock WelliRecord with ${bioStatus.label}`
    );

    setAuthenticating(false);

    if (result.success) {
      hapticFeedback.success();
      actions.unlockWithFaceId();
    } else {
      hapticFeedback.error();
      setErrorMessage(result.error || 'Authentication failed. Tap to retry.');
    }
  }, [authenticating, bioStatus.label, actions]);

  useEffect(() => {
    if (state.showLockScreen) {
      const timer = setTimeout(() => {
        handleUnlock();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [state.showLockScreen, handleUnlock]);

  if (!state.showLockScreen) return null;

  return (
    <Modal
      visible={state.showLockScreen}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.container}>
        <Logo height={30} color="#ffffff" />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleUnlock}
          style={styles.faceIdCircle}
        >
          {authenticating ? (
            <ActivityIndicator color="#0EA5E9" size="large" />
          ) : bioStatus.biometryType === 'fingerprint' ? (
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 11c0 2.5-1.5 4.5-3.5 4.5M12 7c-2.8 0-5 2.2-5 5 0 3.3 2.2 6 5 6s5-2.7 5-6c0-2.8-2.2-5-5-5z"
                stroke="#0EA5E9"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <Path
                d="M12 3c-5 0-9 4-9 9 0 4.5 3 8.3 7 9M12 3c5 0 9 4 9 9 0 2.5-.9 4.8-2.4 6.6"
                stroke="#0EA5E9"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 4.5H5a1.5 1.5 0 00-1.5 1.5v1M18 4.5h1A1.5 1.5 0 0120.5 6v1M6 19.5H5A1.5 1.5 0 013.5 18v-1M18 19.5h1a1.5 1.5 0 001.5-1.5v-1"
                stroke="#0EA5E9"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <Circle cx="9" cy="10.5" r="1" fill="#0EA5E9" />
              <Circle cx="15" cy="10.5" r="1" fill="#0EA5E9" />
              <Path
                d="M9 15c1 1 5 1 6 0"
                stroke="#0EA5E9"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          )}
        </TouchableOpacity>

        <View style={styles.textBlock}>
          <Text style={styles.title}>WelliRecord is locked</Text>
          <Text style={styles.subtitle}>
            {errorMessage ? (
              <Text style={{ color: '#f87171' }}>{errorMessage}</Text>
            ) : (
              `Tap to unlock with ${bioStatus.label}`
            )}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050d1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 30,
  },
  faceIdCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#93a5c9',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
