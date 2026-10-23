import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormSelect } from '../components/FormSelect';
import { STATE_NAMES } from '../data/nigeriaRegions';
import type { WelliApp } from '../state/useWelliApp';

/**
 * A new Google or Apple account must choose a state before it is created, because the state sets
 * the WelliID. Always mounted; hooks run before the early return.
 */
export function SocialStateModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [value, setValue] = useState('');
  const pending = state.socialState;
  if (!pending) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={actions.cancelSocialState}>
      <SafeAreaView style={s.screen}>
        <View style={s.body}>
          <Text style={s.title}>Where do you live?</Text>
          <Text style={s.sub}>
            Your state sets your WelliID when you create your account. The ID does not change if you move later.
          </Text>
          <FormSelect value={value} onChange={setValue} options={STATE_NAMES} placeholder="Select your state" />
          {pending.error ? <Text style={s.err} accessibilityLiveRegion="polite">{pending.error}</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!value || pending.busy}
            onPress={() => void actions.submitSocialState(value)}
            style={[s.primary, (!value || pending.busy) && { opacity: 0.5 }]}
          >
            {pending.busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={actions.cancelSocialState} style={s.link}>
            <Text style={s.linkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 14, color: '#475569', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  err: { color: '#b91c1c', fontSize: 13, marginTop: 10 },
  primary: { backgroundColor: '#315B90', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: '#315B90', fontWeight: '600' },
});
