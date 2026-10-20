import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { securityService, type MfaSetup, type MfaStatus, type SecondStepProof } from '../services/securityService';
import type { WelliApp } from '../state/useWelliApp';

const ACCENT = '#315B90';
type View_ = 'loading' | 'off' | 'setup' | 'codes' | 'on' | 'confirm';

/** Turn the authenticator-app second step on or off, and manage recovery codes. */
export function TwoStepModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [view, setView] = useState<View_>('loading');
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, setPending] = useState<'disable' | 'recovery' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const st = await securityService.mfaStatus();
      setStatus(st);
      setView(st.enabled ? 'on' : 'off');
    } catch (e: any) {
      setError(e?.message || 'Could not load your sign-in settings.');
      setView('off');
    }
  }, []);

  useEffect(() => {
    if (state.showTwoStep) {
      setView('loading');
      setCode('');
      setCodes([]);
      void refresh();
    }
  }, [state.showTwoStep, refresh]);

  if (!state.showTwoStep) return null;

  const text = { color: theme.text } as const;
  const muted = { color: theme.muted } as const;
  const card = { backgroundColor: theme.surface, borderColor: theme.border } as const;
  const proof = (): SecondStepProof => (useRecovery ? { recoveryCode: code.trim() } : { code: code.replace(/\D/g, '') });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => {
    setSetup(await securityService.mfaSetup());
    setCode('');
    setView('setup');
  });

  const enable = () => run(async () => {
    setCodes(await securityService.mfaEnable(code.replace(/\D/g, '')));
    setCode('');
    setView('codes');
  });

  const confirm = () => run(async () => {
    if (pending === 'disable') {
      await securityService.mfaDisable(proof());
      actions.showToast('Authenticator step turned off');
      setCode('');
      setPending(null);
      await refresh();
    } else if (pending === 'recovery') {
      setCodes(await securityService.mfaNewRecoveryCodes(proof()));
      setCode('');
      setPending(null);
      setView('codes');
    }
  });

  const shareCodes = () => {
    Share.share({ message: `WelliRecord recovery codes. Each works once. Keep them somewhere private.\n\n${codes.join('\n')}` }).catch(() => {});
  };

  const codeReady = useRecovery ? code.replace(/[^A-Za-z0-9]/g, '').length >= 10 : code.replace(/\D/g, '').length === 6;

  const codeInput = (
    <>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType={useRecovery ? 'default' : 'number-pad'}
        autoCapitalize={useRecovery ? 'characters' : 'none'}
        autoCorrect={false}
        maxLength={useRecovery ? 12 : 7}
        placeholder={useRecovery ? 'XXXXX-XXXXX' : '6-digit code'}
        placeholderTextColor={theme.mutedLight}
        accessibilityLabel={useRecovery ? 'Recovery code' : 'Authenticator code'}
        style={[st.input, card, text]}
      />
    </>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={actions.closeTwoStep}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <ModalHeader title="Authenticator app" onClose={actions.closeTwoStep} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {view === 'loading' && <ActivityIndicator style={{ marginTop: 40 }} />}

          {view === 'off' && (
            <>
              <Text style={[st.body, text]}>
                Add a second step to sign-in. After your password or login code, WelliRecord asks for a 6-digit code from an authenticator app such as Google Authenticator, Microsoft Authenticator or Authy.
              </Text>
              <Text style={[st.small, muted]}>
                This protects your record if someone gets your password, your email, or swaps your SIM card. You will get 8 recovery codes in case you lose your phone.
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={start} disabled={busy} style={[st.primary, busy && { opacity: 0.6 }]}>
                <Text style={st.primaryText}>{busy ? 'Starting…' : 'Set up'}</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'setup' && setup && (
            <>
              <Text style={[st.h, text]}>1. Add WelliRecord to your authenticator</Text>
              <Text style={[st.small, muted]}>Scan this code from another device, or tap the button to open an authenticator app on this phone.</Text>
              <View style={st.qr}><QRCode value={setup.otpauthUrl} size={180} color="#041E42" backgroundColor="#ffffff" /></View>
              <TouchableOpacity accessibilityRole="button" onPress={() => Linking.openURL(setup.otpauthUrl).catch(() => setError('No authenticator app found. Install one, or type the key below into it.'))} style={[st.secondary, { borderColor: ACCENT }]}>
                <Text style={{ color: ACCENT, fontWeight: '700' }}>Open authenticator app</Text>
              </TouchableOpacity>
              <Text style={[st.small, muted, { marginTop: 14 }]}>Or type this key into your app:</Text>
              <Text selectable style={[st.key, text]}>{setup.secret.match(/.{1,4}/g)?.join(' ')}</Text>
              <Text style={[st.h, text]}>2. Enter the 6-digit code it shows</Text>
              {codeInput}
              <TouchableOpacity accessibilityRole="button" onPress={enable} disabled={busy || !codeReady} style={[st.primary, (busy || !codeReady) && { opacity: 0.5 }]}>
                <Text style={st.primaryText}>{busy ? 'Checking…' : 'Turn on'}</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'codes' && (
            <>
              <Text style={[st.h, text, { marginTop: 0 }]}>Save your recovery codes</Text>
              <Text style={[st.small, muted]}>
                If you lose your phone, each code lets you sign in once. They are shown only now. Store them somewhere private, not in a screenshot gallery that syncs to other people.
              </Text>
              <View style={[st.codes, card]}>
                {codes.map((c) => (<Text key={c} selectable style={[st.code, text]}>{c}</Text>))}
              </View>
              <TouchableOpacity accessibilityRole="button" onPress={shareCodes} style={[st.secondary, { borderColor: ACCENT }]}>
                <Text style={{ color: ACCENT, fontWeight: '700' }}>Save or send to myself</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => { actions.showToast('Authenticator step is on'); void refresh(); }} style={st.primary}>
                <Text style={st.primaryText}>I saved them</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'on' && status && (
            <>
              <View style={[st.card, card]}>
                <Text style={[st.title, text]}>Second step is on</Text>
                <Text style={[st.small, muted]}>{status.recoveryCodesLeft} of 8 recovery codes left.</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" onPress={() => { setPending('recovery'); setCode(''); setUseRecovery(false); setView('confirm'); }} style={[st.secondary, { borderColor: ACCENT, marginTop: 16 }]}>
                <Text style={{ color: ACCENT, fontWeight: '700' }}>Make new recovery codes</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => { setPending('disable'); setCode(''); setUseRecovery(false); setView('confirm'); }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={st.danger}>Turn off</Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'confirm' && (
            <>
              <Text style={[st.h, text, { marginTop: 0 }]}>{pending === 'disable' ? 'Turn off the second step' : 'Make new recovery codes'}</Text>
              <Text style={[st.small, muted]}>
                {pending === 'disable' ? 'Enter a code to confirm it is you. Your record will then be protected by your first sign-in step alone.' : 'Enter a code to confirm it is you. The old codes stop working.'}
              </Text>
              {codeInput}
              <TouchableOpacity accessibilityRole="button" onPress={() => { setUseRecovery((v) => !v); setCode(''); }} style={{ paddingVertical: 8 }}>
                <Text style={{ color: ACCENT, fontWeight: '600' }}>{useRecovery ? 'Use my authenticator app' : 'Use a recovery code instead'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={confirm} disabled={busy || !codeReady} style={[st.primary, (busy || !codeReady) && { opacity: 0.5 }]}>
                <Text style={st.primaryText}>{busy ? 'Checking…' : 'Confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => { setPending(null); setView('on'); }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={muted}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={st.err} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 22 },
  title: { fontSize: 16, fontWeight: '700' },
  err: { color: '#b91c1c', marginTop: 14, fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  primary: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18, minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12, minHeight: 48, justifyContent: 'center' },
  danger: { color: '#b91c1c', fontWeight: '700', fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, letterSpacing: 2, marginTop: 12 },
  qr: { backgroundColor: '#fff', padding: 14, borderRadius: 16, marginVertical: 14, alignSelf: 'center' },
  key: { fontSize: 16, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  codes: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14, gap: 8 },
  code: { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
});
