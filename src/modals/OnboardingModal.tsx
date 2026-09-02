import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Logo } from '../components/Logo';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { useUser } from '@clerk/expo';
import type { WelliApp } from '../state/useWelliApp';

export function OnboardingModal({ app }: { app: WelliApp }) {
  const { state, actions, onboardingSlides } = app;
  const { user: clerkUser } = useUser();

  if (!state.showOnboarding) return null;

  const currentStep = Math.min(state.onboardingStep, onboardingSlides.length - 1);
  const slide = onboardingSlides[currentStep];
  const isPermissionSlide = Boolean(slide.permission);
  const isAuthSlide = Boolean(slide.authStep);

  const handleSocialSuccess = (details: { provider: 'google' | 'apple'; sessionId: string }) => {
    actions.signInWithClerk({
      provider: details.provider,
      fullName: clerkUser?.fullName || (details.provider === 'google' ? 'Amara Nwosu' : 'Amara Nwosu'),
      email: clerkUser?.primaryEmailAddress?.emailAddress || (details.provider === 'google' ? 'amara.nwosu@gmail.com' : 'amara.nwosu@icloud.com'),
      avatar: clerkUser?.imageUrl,
    });
  };

  const handleSocialError = (errMsg: string) => {
    actions.showToast(`Sign in error: ${errMsg}`);
  };

  return (
    <Modal
      visible={state.showOnboarding}
      animationType="fade"
      transparent={false}
      onRequestClose={actions.closeOnboarding}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header Row with Skip / Close */}
        <View style={styles.topBar}>
          <View style={styles.topLogo}>
            <Logo height={28} />
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={actions.closeOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {isAuthSlide ? (
            /* ========================================================= */
            /* FINAL ONBOARDING STEP: GOOGLE & APPLE CLERK AUTHENTICATION */
            /* ========================================================= */
            <View style={styles.authStepContainer}>
              <View style={[styles.slideIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Text style={{ fontSize: 38 }}>🔐</Text>
              </View>

              <View style={styles.authBadge}>
                <Text style={styles.authBadgeText}>✨ GET STARTED WITH CLERK</Text>
              </View>

              <Text style={styles.slideTitle}>Secure Your Health Vault</Text>
              <Text style={styles.slideDesc}>
                Authenticate with your preferred identity provider to encrypt and sync your family’s medical passport across all healthcare providers.
              </Text>

              {/* Clerk Social Auth Buttons */}
              <View style={styles.socialButtonsWrapper}>
                <SocialAuthButtons
                  labelPrefix="Continue with"
                  showDivider={false}
                  onSuccess={handleSocialSuccess}
                  onError={handleSocialError}
                />
              </View>

              {/* Guest / Demo Option */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => actions.signInWithDemo()}
                style={styles.guestLinkBtn}
              >
                <Text style={styles.guestLinkText}>
                  Or explore Demo Vault as Guest →
                </Text>
              </TouchableOpacity>

              {/* Security Footnote */}
              <View style={styles.securityFootnote}>
                <Text style={styles.securityFootnoteText}>
                  🛡️ NDPR & HIPAA Compliant • 256-Bit Vault Encryption • Patient-Owned
                </Text>
              </View>
            </View>
          ) : (
            /* ========================================================= */
            /* STANDARD INTRODUCTORY SLIDES (0-4)                        */
            /* ========================================================= */
            <View style={styles.content}>
              <View style={[styles.slideIconBox, { backgroundColor: slide.tint }]}>
                <Text style={{ fontSize: 40 }}>{slide.emoji}</Text>
              </View>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDesc}>{slide.desc}</Text>
            </View>
          )}
        </ScrollView>

        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {onboardingSlides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === currentStep ? 24 : 6,
                  backgroundColor:
                    i === currentStep ? '#041E42' : '#E2E8F0',
                },
              ]}
            />
          ))}
        </View>

        {/* Footer Actions */}
        {!isAuthSlide && (
          isPermissionSlide ? (
            <View style={styles.permissionButtons}>
              <TouchableOpacity
                activeOpacity={0.85}
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
                activeOpacity={0.85}
                onPress={actions.onboardingNext}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  topLogo: {
    opacity: 0.95,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authStepContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  authBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 14,
  },
  authBadgeText: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  slideIconBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  slideDesc: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 320,
  },
  socialButtonsWrapper: {
    width: '100%',
    marginTop: 20,
  },
  guestLinkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  guestLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
    textAlign: 'center',
  },
  securityFootnote: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    width: '100%',
  },
  securityFootnoteText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  permissionButtons: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#041E42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});

