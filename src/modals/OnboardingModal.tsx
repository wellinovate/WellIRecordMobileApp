import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Logo } from '../components/Logo';
import type { WelliApp } from '../state/useWelliApp';

export function OnboardingModal({ app }: { app: WelliApp }) {
  const { state, actions, onboardingSlides } = app;
  if (!state.showOnboarding) return null;

  const slide = onboardingSlides[state.onboardingStep];
  const isPermissionSlide = !!slide.permission;
  const buttonLabel =
    state.onboardingStep >= onboardingSlides.length - 1 ? 'Get Started' : 'Continue';

  return (
    <Modal
      visible={state.showOnboarding}
      animationType="fade"
      transparent={false}
      onRequestClose={actions.closeOnboarding}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity activeOpacity={0.7} onPress={actions.closeOnboarding}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.logoBox}>
            <Logo height={34} />
          </View>
          <View style={[styles.slideIconBox, { backgroundColor: slide.tint }]}>
            <Text style={{ fontSize: 36 }}>{slide.emoji}</Text>
          </View>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideDesc}>{slide.desc}</Text>
        </View>

        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {onboardingSlides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === state.onboardingStep ? 22 : 6,
                  backgroundColor:
                    i === state.onboardingStep ? '#041E42' : '#e2e8f0',
                },
              ]}
            />
          ))}
        </View>

        {isPermissionSlide ? (
          <View style={styles.permissionButtons}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={actions.allowNotifications}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Allow Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.skipNotifications}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={actions.onboardingNext}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>{buttonLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBox: {
    marginBottom: 24,
  },
  slideIconBox: {
    width: 90,
    height: 90,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  permissionButtons: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  primaryBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});
