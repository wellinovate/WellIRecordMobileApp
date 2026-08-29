import React from 'react';
import { Modal, SafeAreaView, StyleSheet } from 'react-native';
import { WelcomeHomeScreen } from '../screens/WelcomeHomeScreen';
import type { WelliApp } from '../state/useWelliApp';

export function WelcomeHomeModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const isVisible = state.showWelcomeHome || state.loggedOut;

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (!state.loggedOut) {
          actions.closeWelcomeHome();
        }
      }}
    >
      <SafeAreaView style={styles.safeArea}>
        <WelcomeHomeScreen app={app} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

