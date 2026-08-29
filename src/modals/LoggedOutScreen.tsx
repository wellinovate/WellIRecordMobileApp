import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Logo } from '../components/Logo';
import type { WelliApp } from '../state/useWelliApp';

export function LoggedOutScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.loggedOut) return null;

  return (
    <Modal
      visible={state.loggedOut}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.container}>
        <Logo height={32} />

        <View style={styles.iconCircle}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 12h11m0 0l-3.5-3.5M20 12l-3.5 3.5"
              stroke="#64748b"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M13 5H6a2 2 0 00-2 2v10a2 2 0 002 2h7"
              stroke="#64748b"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>You've been logged out</Text>
          <Text style={styles.subtitle}>
            Your session has ended. Log back in to access your health records.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={actions.logBackIn}
          style={styles.loginBtn}
        >
          <Text style={styles.loginBtnText}>Log Back In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#eef2f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
