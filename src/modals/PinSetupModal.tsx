import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { PinPad } from '../components/PinPad';
import { useTheme } from '../theme/ThemeContext';
import { appPin } from '../utils/appPin';
import { PIN_LENGTH, weakPinReason } from '../utils/pinCore';
import type { WelliApp } from '../state/useWelliApp';

type Step = 'home' | 'current' | 'new' | 'confirm';

/** Set, change or remove the app PIN. The PIN stays on this phone and is checked here; the server never sees it. */
export function PinSetupModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const open = state.showPinSetup;
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('home');
  const [intent, setIntent] = useState<'set' | 'change' | 'remove'>('set');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setHasPin(await appPin.isSet()), []);

  useEffect(() => {
    if (open) {
      setStep('home');
      setPin('');
      setFirst('');
      setError(null);
      load();
    }
  }, [open, load]);

  if (!open) return null;

  const close = () => actions.closePinSetup();
  const goHome = async () => {
    setStep('home');
    setPin('');
    setFirst('');
    setError(null);
    await load();
  };

  const start = (i: 'set' | 'change' | 'remove') => {
    setIntent(i);
    setPin('');
    setError(null);
    setStep(i === 'set' ? 'new' : 'current');
  };

  const onDigits = async (next: string) => {
    setPin(next);
    setError(null);
    if (next.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    try {
      if (step === 'current') {
        const r = await appPin.verify(next);
        if (!r.ok) {
          setPin('');
          setError(r.blocked ? 'Too many wrong PINs. Lock the app, unlock another way, then try again.' : `Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`);
          return;
        }
        if (intent === 'remove') {
          await appPin.remove();
          actions.showToast('PIN removed');
          await goHome();
        } else {
          setPin('');
          setStep('new');
        }
      } else if (step === 'new') {
        const weak = weakPinReason(next);
        if (weak) {
          setPin('');
          setError(weak);
          return;
        }
        setFirst(next);
        setPin('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (next !== first) {
          setPin('');
          setFirst('');
          setStep('new');
          setError('The two PINs did not match. Start again.');
          return;
        }
        await appPin.set(next);
        actions.showToast(intent === 'change' ? 'PIN changed' : 'PIN set');
        await goHome();
      }
    } catch (e: any) {
      setPin('');
      setError(e?.message || 'Could not save the PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const heading =
    step === 'current' ? 'Enter your current PIN' : step === 'new' ? `Choose a ${PIN_LENGTH}-digit PIN` : 'Enter it again to confirm';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="App PIN" onClose={close} onBack={step === 'home' ? undefined : goHome} showBack={step !== 'home'} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'home' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>{hasPin ? 'A PIN is set' : 'No PIN set'}</Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                A PIN lets you unlock WelliRecord with {PIN_LENGTH} digits as well as your fingerprint or face. It stays on this phone and is never sent to us.
                After 5 wrong tries the PIN stops working until you unlock another way, with your fingerprint, face or an emailed code.
              </Text>
              {hasPin === false ? (
                <TouchableOpacity accessibilityRole="button" onPress={() => start('set')} style={styles.btn}>
                  <Text style={styles.btnText}>Set a PIN</Text>
                </TouchableOpacity>
              ) : null}
              {hasPin ? (
                <>
                  <TouchableOpacity accessibilityRole="button" onPress={() => start('change')} style={styles.btn}>
                    <Text style={styles.btnText}>Change PIN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" onPress={() => start('remove')} style={[styles.btn, styles.danger]}>
                    <Text style={styles.btnText}>Remove PIN</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <Text style={[styles.note, { color: theme.muted }]}>
                If you forget it, choose "Forgot PIN" on the lock screen. A code sent to your email or phone unlocks the app and removes the PIN. Signing out also removes it.
              </Text>
            </>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.title, { color: theme.text }]}>{heading}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PinPad value={pin} onChange={onDigits} disabled={busy} dark={false} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14.5, lineHeight: 21 },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  error: { color: '#B91C1C', fontSize: 13, textAlign: 'center', marginTop: 6 },
  btn: { backgroundColor: '#082F67', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  danger: { backgroundColor: '#b91c1c' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
