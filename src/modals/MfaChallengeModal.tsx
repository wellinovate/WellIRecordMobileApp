import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WelliApp } from '../state/useWelliApp';

const ACCENT = '#315B90';

/**
 * Asks for the authenticator code after the first sign-in step. Always mounted; hooks run before
 * the early return, as every modal in this app must.
 */
export function MfaChallengeModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const prompt = state.mfaPrompt;
  if (!prompt) return null;

  const ready = useRecovery ? code.replace(/[^A-Za-z0-9]/g, '').length >= 10 : code.replace(/\D/g, '').length === 6;
  const submit = () => {
    if (!ready || prompt.busy) return;
    const value = code.trim();
    setCode('');
    void actions.submitMfaCode(useRecovery ? { recoveryCode: value } : { code: value.replace(/\D/g, '') });
  };

  return (
    <Modal visible animationType="fade" onRequestClose={actions.cancelMfa}>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.body}>
          <Text style={s.title}>{useRecovery ? 'Enter a recovery code' : 'Enter your authenticator code'}</Text>
          <Text style={s.sub}>
            {useRecovery
              ? 'Use one of the 8 recovery codes you saved when you turned this on. Each works once.'
              : 'Open your authenticator app and enter the 6-digit code for WelliRecord.'}
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoFocus
            autoCapitalize={useRecovery ? 'characters' : 'none'}
            autoCorrect={false}
            keyboardType={useRecovery ? 'default' : 'number-pad'}
            maxLength={useRecovery ? 12 : 7}
            placeholder={useRecovery ? 'XXXXX-XXXXX' : '123456'}
            placeholderTextColor="#9AA3AF"
            accessibilityLabel={useRecovery ? 'Recovery code' : 'Authenticator code'}
            textContentType="oneTimeCode"
            style={s.input}
            onSubmitEditing={submit}
          />
          {prompt.error ? <Text style={s.err} accessibilityLiveRegion="polite">{prompt.error}</Text> : null}
          <TouchableOpacity accessibilityRole="button" disabled={!ready || prompt.busy} onPress={submit} style={[s.primary, (!ready || prompt.busy) && { opacity: 0.5 }]}>
            {prompt.busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setUseRecovery((v) => !v); setCode(''); }} style={s.link}>
            <Text style={s.linkText}>{useRecovery ? 'Use my authenticator app' : 'Lost your phone? Use a recovery code'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={actions.cancelMfa} style={s.link}>
            <Text style={[s.linkText, { color: '#6B7280' }]}>Cancel sign-in</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#082F67' },
  sub: { fontSize: 14, lineHeight: 20, color: '#4B5563', marginTop: 8, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 22, letterSpacing: 4, color: '#111827' },
  err: { color: '#b91c1c', marginTop: 10, fontSize: 14 },
  primary: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18, minHeight: 50, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { paddingVertical: 14, alignItems: 'center' },
  linkText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
});
