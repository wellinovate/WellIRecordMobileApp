import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Logo } from '../components/Logo';
import {
  getBiometricStatus,
  authenticateWithBiometrics,
  type BiometricStatus,
} from '../utils/biometrics';
import { hapticFeedback } from '../utils/haptics';
import { appPin } from '../utils/appPin';
import { PIN_LENGTH } from '../utils/pinCore';
import { PinPad } from '../components/PinPad';
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
  // 'pin' shows when the person has set an app PIN. 'code' is the fallback: a 6-digit code sent to the email or phone on the account.
  const [mode, setMode] = useState<'biometric' | 'pin' | 'code'>('biometric');
  const [pinLoaded, setPinLoaded] = useState(false);
  const [bioLoaded, setBioLoaded] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinBlocked, setPinBlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [resetPin, setResetPin] = useState(false); // the code is for a forgotten PIN, so a good code removes it
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const autoPrompted = useRef(false);

  useEffect(() => {
    getBiometricStatus()
      .then(setBioStatus)
      .finally(() => setBioLoaded(true));
    Promise.all([appPin.isSet(), appPin.isBlocked()])
      .then(([set, blocked]) => {
        setHasPin(set);
        setPinBlocked(set && blocked);
        if (set) setMode('pin');
      })
      .finally(() => setPinLoaded(true));
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

  // Ask once each time the lock appears, not again after a cancel (that would trap the person in a loop of prompts).
  useEffect(() => {
    // App.expo mounts this screen only while locked, so every lock starts with fresh state.
    if (!state.showLockScreen || autoPrompted.current || mode === 'code' || !bioLoaded || !pinLoaded) return;
    // With a PIN set the pad is already on screen, so only ask for the fingerprint or face when the phone has one.
    if (mode === 'pin' && !bioStatus.isAvailable) return;
    const timer = setTimeout(() => {
      autoPrompted.current = true;
      handleUnlock();
    }, 400);
    return () => clearTimeout(timer);
  }, [state.showLockScreen, mode, handleUnlock, bioLoaded, pinLoaded, bioStatus.isAvailable]);

  const onPinChange = useCallback(
    async (next: string) => {
      setPin(next);
      setErrorMessage(null);
      if (next.length !== PIN_LENGTH || busy) return;
      setBusy(true);
      try {
        const r = await actions.unlockWithPin(next);
        if (!r.ok) {
          setPin('');
          setPinBlocked(r.blocked);
          setErrorMessage(
            r.blocked
              ? 'Too many wrong PINs. Unlock another way.'
              : `Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`,
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, actions],
  );

  const sendCode = useCallback(async (forgotPin = false) => {
    if (busy) return;
    setResetPin(forgotPin);
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await actions.sendUnlockCode();
      setSentTo(res.sentTo);
      setMode('code');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send a code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, actions]);

  const submitCode = useCallback(async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      await actions.unlockWithCode(digits, { resetPin });
    } catch (err: unknown) {
      hapticFeedback.error();
      setCode('');
      setErrorMessage(err instanceof Error ? err.message : 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }, [code, busy, actions, resetPin]);

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

        {mode === 'pin' && !bioStatus.isAvailable ? null : (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleUnlock}
          style={[styles.faceIdCircle, mode === 'pin' && { width: 64, height: 64, borderRadius: 32 }]}
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
        )}

        {mode === 'biometric' ? (
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
        ) : mode === 'pin' ? (
          <View style={styles.textBlock}>
            <Text style={styles.title}>Enter your PIN</Text>
            <Text style={styles.subtitle}>
              {errorMessage ? (
                <Text style={{ color: '#f87171' }}>{errorMessage}</Text>
              ) : pinBlocked ? (
                'Too many wrong PINs. Unlock another way.'
              ) : (
                `Enter your ${PIN_LENGTH}-digit PIN${bioStatus.isAvailable ? ` or use ${bioStatus.label}` : ''}`
              )}
            </Text>
            <PinPad value={pin} onChange={onPinChange} disabled={busy || pinBlocked} />
          </View>
        ) : (
          <View style={styles.textBlock}>
            <Text style={styles.title}>Enter your unlock code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {sentTo}.{resetPin ? ' Your PIN will be removed. Set a new one in Account security.' : ''}
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textContentType="oneTimeCode"
              placeholder="123456"
              placeholderTextColor="#5b6b8c"
              accessibilityLabel="Unlock code"
              onSubmitEditing={submitCode}
              style={styles.codeInput}
            />
            {errorMessage ? <Text style={{ color: '#f87171', marginTop: 8, textAlign: 'center' }}>{errorMessage}</Text> : null}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || code.length !== 6}
              onPress={submitCode}
              style={[styles.primary, (busy || code.length !== 6) && { opacity: 0.5 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Unlock</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.links}>
          {mode === 'biometric' ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => sendCode(false)} disabled={busy} style={styles.link}>
              {busy ? <ActivityIndicator color="#93a5c9" /> : <Text style={styles.linkText}>Unlock with a code instead</Text>}
            </TouchableOpacity>
          ) : mode === 'pin' ? (
            <>
              {bioStatus.isAvailable ? (
                <TouchableOpacity accessibilityRole="button" onPress={handleUnlock} disabled={authenticating} style={styles.link}>
                  <Text style={styles.linkText}>Use {bioStatus.label}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity accessibilityRole="button" onPress={() => sendCode(true)} disabled={busy} style={styles.link}>
                <Text style={styles.linkText}>Forgot PIN? Unlock with a code</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity accessibilityRole="button" onPress={() => sendCode(resetPin)} disabled={busy} style={styles.link}>
                <Text style={styles.linkText}>Send a new code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setMode(hasPin ? 'pin' : 'biometric');
                  setResetPin(false);
                  setErrorMessage(null);
                }}
                style={styles.link}
              >
                <Text style={styles.linkText}>
                  {hasPin ? 'Use my PIN instead' : `Use ${bioStatus.isAvailable ? bioStatus.label : 'my phone lock'} instead`}
                </Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity accessibilityRole="button" onPress={() => { void actions.logOut(); }} style={styles.link}>
            <Text style={[styles.linkText, { color: '#64748b' }]}>Sign out</Text>
          </TouchableOpacity>
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
    gap: 16,
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
    alignSelf: 'stretch',
  },
  codeInput: {
    marginTop: 14,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 6,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  primary: {
    alignSelf: 'stretch',
    marginTop: 14,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  links: { alignItems: 'center', marginTop: 4 },
  link: { paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  linkText: { color: '#93a5c9', fontSize: 14, fontWeight: '600' },
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
