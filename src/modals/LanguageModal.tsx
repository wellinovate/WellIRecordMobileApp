import React from 'react';
import {
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { LANGUAGES } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function LanguageModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showLanguage) return null;

  return (
    <Modal
      visible={state.showLanguage}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeLanguage}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Language (optional)"
          onClose={actions.closeLanguage}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {LANGUAGES.map((l) => {
            const checked = state.language === l;
            return (
              <TouchableOpacity
                key={l}
                activeOpacity={0.7}
                onPress={() => actions.setLanguage(l)}
                style={[
                  styles.langCard,
                  {
                    borderColor: checked ? '#0EA5E9' : '#e2e8f0',
                    backgroundColor: checked ? '#f0f9ff' : '#ffffff',
                  },
                ]}
              >
                <Text style={styles.langLabel}>{l}</Text>
                {checked && (
                  <Svg width={18} height={18} viewBox="0 0 20 20">
                    <Circle cx="10" cy="10" r="9" fill="#0EA5E9" />
                    <Path
                      d="M6 10l3 3 5-6"
                      stroke="#ffffff"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}
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
    gap: 10,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  langLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0f172a',
  },
});
