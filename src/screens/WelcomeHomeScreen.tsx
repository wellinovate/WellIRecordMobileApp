import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Logo } from '../components/Logo';
import { FormSelect } from '../components/FormSelect';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { useUser } from '@clerk/expo';
import { BLOOD_TYPES, GENOTYPES } from '../data/mockData';
import { authenticateWithBiometrics } from '../utils/biometrics';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';
import type { SignUpFormData, WelcomeTab } from '../data/types';

const HMO_PROVIDERS = [
  'Hygeia HMO',
  'AXA Mansard Health',
  'Reliance HMO',
  'Leadway Health',
  'Avon Healthcare',
  'Total Health Trust',
  'Clearline HMO',
  'Private Self-Pay / None',
];

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'How does WelliRecord protect my medical data?',
    a: 'All records are encrypted end-to-end using AES-256 standards both at rest and in transit. WelliRecord complies with NDPR (Nigeria Data Protection Regulation) and international HIPAA security guidelines. Only you decide who gets access.',
  },
  {
    q: 'What happens in an emergency if I am unconscious?',
    a: 'Your Emergency Medical ID features a high-visibility QR code. First responders and ER physicians can scan it to instantly view critical life-saving details: blood type, genotype, severe allergies, and primary emergency contacts—without accessing your private clinical records.',
  },
  {
    q: 'Can I manage my children and elderly parents?',
    a: 'Yes! WelliRecord supports multi-generational family accounts. As a guardian, you can add dependents, upload immunization cards, manage prescriptions, and track proxy access logs seamlessly.',
  },
  {
    q: 'Does WelliRecord work with all Nigerian hospitals and clinics?',
    a: 'Yes. WelliRecord is completely patient-owned and universal. You can digitize, upload, and organize paper cards, prescription slips, lab results, and digital summaries from any hospital, clinic, diagnostic center, or pharmacy in Nigeria.',
  },
  {
    q: 'Can a doctor modify or delete my records?',
    a: 'No. Doctors can only view records you share. If you grant explicit write access via Smart Consent (e.g. to attach a lab result), all additions are timestamped and logged in your immutable audit trail.',
  },
  {
    q: 'Is there a cost to store and share records?',
    a: 'Creating a family vault, storing medical records, generating WelliBridge emergency codes, and basic sharing are 100% free for all patients.',
  },
];


export function WelcomeHomeScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const { user: clerkUser } = useUser();
  const activeTab: WelcomeTab = state.welcomeTab || 'about';

  // Authentication Flow Navigation & Mode State
  const [authStep, setAuthStep] = useState<'form' | 'otp_verify'>('form');
  const [signInMethod, setSignInMethod] = useState<'otp' | 'password'>('otp');
  const [pendingAuth, setPendingAuth] = useState<{
    mode: 'signin' | 'signup';
    identifier: string;
    channel: 'phone' | 'email';
    signUpData?: SignUpFormData;
  } | null>(null);

  // 6-Digit Verification Code State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(30);
  const otpInputsRef = useRef<Array<TextInput | null>>([]);

  // Sign In State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authenticatingBio, setAuthenticatingBio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Sign Up State
  const [signUpData, setSignUpData] = useState<SignUpFormData>({
    name: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    insuranceProvider: 'Hygeia HMO',
    insuranceId: '',
    bloodType: 'O+',
    genotype: 'AA',
  });
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [signUpError, setSignUpError] = useState<string | null>(null);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Resend Countdown Timer
  useEffect(() => {
    if (authStep !== 'otp_verify' || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [authStep, resendCooldown]);

  const handleTabChange = (tab: WelcomeTab) => {
    hapticFeedback.selection();
    setSignInError(null);
    setSignUpError(null);
    setAuthStep('form');
    actions.setWelcomeTab(tab);
  };

  const handleOtpBoxChange = (val: string, index: number) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    setSignInError(null);
    setSignUpError(null);

    if (cleanVal && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== '') && cleanVal) {
      triggerVerifyOtp(newDigits.join(''));
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otpDigits[index] === '' && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handleSendOtpSignIn = async () => {
    if (!loginIdentifier.trim()) {
      setSignInError('Please enter your phone number or email address');
      hapticFeedback.error();
      return;
    }
    setSignInError(null);
    setIsSubmitting(true);
    try {
      const channel = loginIdentifier.includes('@') ? 'email' : 'phone';
      await actions.sendAuthOtp(loginIdentifier.trim(), channel, undefined, 'login');
      setPendingAuth({
        mode: 'signin',
        identifier: loginIdentifier.trim(),
        channel,
      });
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(30);
      setAuthStep('otp_verify');
    } catch (err: any) {
      setSignInError(err?.message || 'Failed to dispatch verification code. Please try again.');
      hapticFeedback.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSignIn = async () => {
    if (!loginIdentifier.trim()) {
      setSignInError('Please enter your email address or phone number');
      hapticFeedback.error();
      return;
    }
    setSignInError(null);
    setIsSubmitting(true);
    try {
      await actions.signInWithCredentials(loginIdentifier.trim(), loginPassword.trim());
    } catch (err: any) {
      setSignInError(err?.message || 'Invalid credentials. Please verify and try again.');
      hapticFeedback.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setAuthenticatingBio(true);
    hapticFeedback.light();
    const result = await authenticateWithBiometrics('Sign in to WelliRecord');
    setAuthenticatingBio(false);
    if (result.success) {
      actions.signInWithCredentials('amara.nwosu@gmail.com');
    }
  };

  const handleSendOtpSignUp = async () => {
    if (!signUpData.name.trim()) {
      setSignUpError('Please enter your full name');
      hapticFeedback.error();
      return;
    }
    if (!signUpData.email.trim() && !signUpData.phone.trim()) {
      setSignUpError('Please provide an email or phone number');
      hapticFeedback.error();
      return;
    }
    if (!agreeTerms) {
      setSignUpError('Please agree to the Terms of Service & NDPR Privacy Policy');
      hapticFeedback.error();
      return;
    }
    setSignUpError(null);
    setIsSubmitting(true);
    try {
      const targetId = signUpData.phone.trim() || signUpData.email.trim();
      const channel = signUpData.phone.trim() ? 'phone' : 'email';
      const cleanHmo = (!signUpData.insuranceProvider || signUpData.insuranceProvider === 'Private Self-Pay / None' || signUpData.insuranceProvider === 'None')
        ? undefined
        : signUpData.insuranceProvider;
      const cleanInsuranceId = cleanHmo ? (signUpData.insuranceId?.trim() || undefined) : undefined;

      const sanitizedSignUpData: SignUpFormData = {
        ...signUpData,
        insuranceProvider: cleanHmo,
        insuranceId: cleanInsuranceId,
      };

      await actions.sendAuthOtp(targetId, channel, signUpData.name.trim(), 'signup');
      setPendingAuth({
        mode: 'signup',
        identifier: targetId,
        channel,
        signUpData: sanitizedSignUpData,
      });
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(30);
      setAuthStep('otp_verify');
    } catch (err: any) {
      setSignUpError(err?.message || 'Registration failed. Please try again.');
      hapticFeedback.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length < 6) {
      const msg = 'Please enter the complete 6-digit authorization code';
      if (pendingAuth?.mode === 'signin') setSignInError(msg);
      else setSignUpError(msg);
      hapticFeedback.error();
      return;
    }
    if (!pendingAuth) return;
    setIsSubmitting(true);
    try {
      if (pendingAuth.mode === 'signin') {
        await actions.verifyAuthOtp(pendingAuth.identifier, code);
      } else {
        await actions.verifyAuthOtp(pendingAuth.identifier, code, pendingAuth.signUpData);
      }
    } catch (err: any) {
      const msg = err?.message || 'Invalid or expired code. Please check and retry.';
      if (pendingAuth.mode === 'signin') setSignInError(msg);
      else setSignUpError(msg);
      hapticFeedback.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingAuth || resendCooldown > 0) return;
    setIsSubmitting(true);
    try {
      await actions.sendAuthOtp(
        pendingAuth.identifier,
        pendingAuth.channel,
        undefined,
        pendingAuth.mode === 'signin' ? 'login' : 'signup'
      );
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      actions.showToast(`New 6-digit code sent to ${pendingAuth.identifier}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to resend code';
      if (pendingAuth.mode === 'signin') setSignInError(msg);
      else setSignUpError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top App Header with Safe-Area Clearance */}
        <View style={styles.topHeader}>
          <View style={styles.logoRow}>
            <Logo height={28} color="#041E42" />
            <View style={styles.countryBadge}>
              <Text style={styles.countryBadgeText}>🇳🇬 Nigeria</Text>
            </View>
          </View>
        </View>

        {/* Navigation Switcher Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabChange('about')}
            style={[styles.navTab, activeTab === 'about' && styles.navTabActive]}
          >
            <Text
              style={[
                styles.navTabText,
              activeTab === 'about' && styles.navTabTextActive,
            ]}
          >
            About
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabChange('signin')}
          style={[styles.navTab, activeTab === 'signin' && styles.navTabActive]}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'signin' && styles.navTabTextActive,
            ]}
          >
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabChange('signup')}
          style={[styles.navTab, activeTab === 'signup' && styles.navTabActive]}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'signup' && styles.navTabTextActive,
            ]}
          >
            Create Vault
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabChange('faq')}
          style={[styles.navTab, activeTab === 'faq' && styles.navTabActive]}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'faq' && styles.navTabTextActive,
            ]}
          >
            FAQ
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. ABOUT & HOW IT WORKS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'about' && (
        <View style={styles.tabContent}>
          {/* Hero Banner */}
          <LinearGradient
            colors={['#041E42', '#0A3B7B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>PATIENT-OWNED HEALTH PASSPORT</Text>
            </View>
            <Text style={styles.heroTitle}>
              Your Family's Complete Health Records, Always With You.
            </Text>
            <Text style={styles.heroSubtitle}>
              Consolidate hospital folders, lab results, prescriptions, and HMO coverage in one encrypted vault with instant WelliBridge QR emergency sharing.
            </Text>

            <View style={styles.heroCtaRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleTabChange('signup')}
                style={styles.heroPrimaryBtn}
              >
                <Text style={styles.heroPrimaryText}>Create Vault ›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleTabChange('signin')}
                style={styles.heroSecondaryBtn}
              >
                <Text style={styles.heroSecondaryText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => actions.openOnboarding()}
                style={[styles.heroSecondaryBtn, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' }]}
              >
                <Text style={styles.heroSecondaryText}>✨ Tour</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* 1. Real Product Screenshot Showcase */}
          <View style={styles.showcaseSection}>
            <View style={styles.showcaseHeader}>
              <View style={styles.showcaseBadge}>
                <Text style={styles.showcaseBadgeText}>LIVE VAULT PREVIEW</Text>
              </View>
              <Text style={styles.showcaseTitle}>Inside Your WelliRecord Vault</Text>
              <Text style={styles.showcaseSub}>
                Your Emergency ID, verified OCR lab diagnostics, and instant WelliBridge doctor sharing in one unified screen.
              </Text>
            </View>

            <View style={styles.screenshotFrame}>
              <Image
                source={require('../../assets/product_preview.png')}
                style={styles.screenshotImage}
                resizeMode="contain"
                accessibilityLabel="WelliRecord Patient Health Dashboard Mobile Screenshot"
              />
            </View>

            {/* Proof Points Strip */}
            <View style={styles.proofPointsRow}>
              <View style={styles.proofPointItem}>
                <Text style={styles.proofPointIcon}>🔒</Text>
                <Text style={styles.proofPointText}>AES-256 Encrypted</Text>
              </View>
              <View style={styles.proofPointDivider} />
              <View style={styles.proofPointItem}>
                <Text style={styles.proofPointIcon}>⚡</Text>
                <Text style={styles.proofPointText}>Under 5s ER Retrieval</Text>
              </View>
              <View style={styles.proofPointDivider} />
              <View style={styles.proofPointItem}>
                <Text style={styles.proofPointIcon}>🛡️</Text>
                <Text style={styles.proofPointText}>NDPR Compliant</Text>
              </View>
            </View>
          </View>

          {/* 2. How WelliRecord Works 3-Step Guide */}
          <View style={styles.howItWorksSection}>
            <Text style={styles.sectionTitle}>How WelliRecord Works in 3 Steps</Text>
            <View style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: '#0EA5E9' }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Digitize & Upload</Text>
                  <Text style={styles.stepDesc}>
                    Snap photos of physical cards, prescriptions, and lab tests. Our clinical OCR extracts key metrics in seconds.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Smart Consent Sharing</Text>
                  <Text style={styles.stepDesc}>
                    Share via 6-digit WelliBridge PIN or timed QR with verified doctors. Full revocation and audit logs at any moment.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: '#6366f1' }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Consult, Book & Track</Text>
                  <Text style={styles.stepDesc}>
                    Book visits at 100+ partner hospitals, manage dependents in one account, and track health history seamlessly.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. The Numbers: Old Paper Way vs WelliRecord Way (Closer) */}
          <View style={styles.comparisonBox}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonHeading}>The Numbers: Paper Folders vs WelliRecord</Text>
              <Text style={styles.comparisonSub}>
                Every comparison backed by concrete costs, wait times, and verified Nigerian healthcare outcomes.
              </Text>
            </View>

            <View style={styles.compRow}>
              {/* Paper Way Column */}
              <View style={styles.compColumnOld}>
                <Text style={styles.compColTitleRed}>❌ Old Paper Way</Text>
                <View style={styles.compMetricCardRed}>
                  <Text style={styles.compMetricLabelRed}>REPEAT LAB COSTS</Text>
                  <Text style={styles.compItem}>• ₦25,000+ repeat tests every time paper results are lost</Text>
                </View>
                <View style={styles.compMetricCardRed}>
                  <Text style={styles.compMetricLabelRed}>RETRIEVAL WAIT TIME</Text>
                  <Text style={styles.compItem}>• 45–90 mins waiting for physical hospital folders to be located</Text>
                </View>
                <View style={styles.compMetricCardRed}>
                  <Text style={styles.compMetricLabelRed}>FAMILY VISIBILITY</Text>
                  <Text style={styles.compItem}>• 0 shared access: scattered immunization cards for 2+ kids</Text>
                </View>
                <View style={styles.compMetricCardRed}>
                  <Text style={styles.compMetricLabelRed}>HMO REIMBURSEMENT</Text>
                  <Text style={styles.compItem}>• 30+ day HMO reimbursement delays with lost paper receipts</Text>
                </View>
              </View>

              {/* WelliRecord Way Column */}
              <View style={styles.compColumnNew}>
                <Text style={styles.compColTitleGreen}>✅ WelliRecord Way</Text>
                <View style={styles.compMetricCardGreen}>
                  <Text style={styles.compMetricLabelGreen}>ZERO DUPLICATION</Text>
                  <Text style={styles.compItem}>• ₦0 repeat test fees: permanent cloud vault across hospitals</Text>
                </View>
                <View style={styles.compMetricCardGreen}>
                  <Text style={styles.compMetricLabelGreen}>INSTANT ACCESS</Text>
                  <Text style={styles.compItem}>• Under 5 seconds retrieval with a 6-digit WelliBridge PIN</Text>
                </View>
                <View style={styles.compMetricCardGreen}>
                  <Text style={styles.compMetricLabelGreen}>CENTRALIZED VAULT</Text>
                  <Text style={styles.compItem}>• Up to 6 family members in 1 account with proxy audit logs</Text>
                </View>
                <View style={styles.compMetricCardGreen}>
                  <Text style={styles.compMetricLabelGreen}>FASTER CLAIMS</Text>
                  <Text style={styles.compItem}>• 1-tap PDF & Naira receipt export for instant HMO claims</Text>
                </View>
              </View>
            </View>

            {/* Bottom Conversion Closer */}
            <View style={styles.closerCtaBox}>
              <Text style={styles.closerCtaTitle}>Never lose a health record or repay ₦25,000 for a lost test again.</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleTabChange('signup')}
                style={styles.closerCtaBtn}
              >
                <Text style={styles.closerCtaBtnText}>Create Your Free Vault ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. SIGN IN & 3. SIGN UP (WITH DEDICATED 6-DIGIT OTP VERIFICATION) */}
      {/* ========================================================================= */}
      
      {/* A) DEDICATED 6-DIGIT OTP VERIFICATION CARD */}
      {authStep === 'otp_verify' && pendingAuth && (
        <View style={styles.tabContent}>
          <View style={styles.formCard}>
            <View style={styles.otpHeaderBadge}>
              <Text style={styles.otpHeaderBadgeText}>
                {pendingAuth.channel === 'phone' ? '📱 SMS AUTHORIZATION' : '✉️ EMAIL AUTHORIZATION'}
              </Text>
            </View>
            <Text style={styles.formTitle}>Enter 6-Digit Code</Text>
            <Text style={styles.formSubtitle}>
              We dispatched a secure authorization code to{' '}
              <Text style={{ fontWeight: '800', color: '#0f172a' }}>{pendingAuth.identifier}</Text>.
            </Text>

            {(signInError || signUpError) && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>⚠️ {signInError || signUpError}</Text>
              </View>
            )}

            {/* 6 Box Inputs */}
            <View style={styles.otpBoxesRow}>
              {otpDigits.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => {
                    otpInputsRef.current[idx] = el;
                  }}
                  value={digit}
                  onChangeText={(v) => handleOtpBoxChange(v, idx)}
                  onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                  ]}
                />
              ))}
            </View>

            {/* Main Verify Submit Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => triggerVerifyOtp()}
              disabled={isSubmitting}
              style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Verify & Unlock Health Vault</Text>
              )}
            </TouchableOpacity>

            {/* Resend Code Section */}
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the SMS/Email code?</Text>
              {resendCooldown > 0 ? (
                <Text style={styles.resendTimerText}>Resend in {resendCooldown}s</Text>
              ) : (
                <TouchableOpacity activeOpacity={0.7} onPress={handleResendOtp}>
                  <Text style={styles.resendActionText}>🔄 Resend Code Now</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Back to Form link */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.light();
                setAuthStep('form');
                setSignInError(null);
                setSignUpError(null);
              }}
              style={styles.backLinkBtn}
            >
              <Text style={styles.backLinkText}>
                ← Change {pendingAuth.channel === 'phone' ? 'Phone Number' : 'Email Address'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* B) SIGN IN FORM (WHEN NOT IN OTP VERIFICATION) */}
      {activeTab === 'signin' && authStep === 'form' && (
        <View style={styles.tabContent}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>
              Sign in to manage your health records, shares, and family vault.
            </Text>

            {/* Method Toggle: OTP Code vs Password */}
            <View style={styles.authModeSelector}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setSignInMethod('otp');
                  setSignInError(null);
                }}
                style={[styles.authModeBtn, signInMethod === 'otp' && styles.authModeBtnActive]}
              >
                <Text style={[styles.authModeBtnText, signInMethod === 'otp' && styles.authModeBtnTextActive]}>
                  📱 SMS / Email Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setSignInMethod('password');
                  setSignInError(null);
                }}
                style={[styles.authModeBtn, signInMethod === 'password' && styles.authModeBtnActive]}
              >
                <Text style={[styles.authModeBtnText, signInMethod === 'password' && styles.authModeBtnTextActive]}>
                  🔒 Password
                </Text>
              </TouchableOpacity>
            </View>

            {signInError && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>⚠️ {signInError}</Text>
              </View>
            )}

            {/* Email / Phone Input */}
            <Text style={styles.inputLabel}>
              {signInMethod === 'otp' ? 'Phone Number (+234) or Email' : 'Email or Phone Number'}
            </Text>
            <TextInput
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              placeholder={signInMethod === 'otp' ? 'e.g. +234 805 335 5504 or email' : 'e.g. yourname@domain.com or +234...'}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType={signInMethod === 'otp' ? 'default' : 'email-address'}
              style={styles.textInput}
            />

            {signInMethod === 'password' ? (
              <>
                {/* Password Input */}
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="Enter your vault password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Text style={{ fontSize: 13, color: '#0EA5E9', fontWeight: '600' }}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Remember Me & Forgot Password */}
                <View style={styles.authMetaRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setRememberMe(!rememberMe)}
                    style={styles.rememberMeGroup}
                  >
                    <View style={[styles.customCheck, rememberMe && styles.customCheckActive]}>
                      {rememberMe && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticFeedback.selection();
                      actions.showToast('Password reset link sent to your registered email');
                    }}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Main Sign In Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePasswordSignIn}
                  disabled={isSubmitting}
                  style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Sign In to Vault</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Send OTP Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSendOtpSignIn}
                  disabled={isSubmitting}
                  style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Send 6-Digit Authorization Code ›</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Biometric Sign In Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleBiometricSignIn}
              style={styles.biometricBtn}
            >
              {authenticatingBio ? (
                <ActivityIndicator color="#0EA5E9" size="small" />
              ) : (
                <>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 4.5H5a1.5 1.5 0 00-1.5 1.5v1M18 4.5h1A1.5 1.5 0 0120.5 6v1M6 19.5H5A1.5 1.5 0 013.5 18v-1M18 19.5h1a1.5 1.5 0 001.5-1.5v-1"
                      stroke="#0EA5E9"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <Circle cx="9" cy="10.5" r="1" fill="#0EA5E9" />
                    <Circle cx="15" cy="10.5" r="1" fill="#0EA5E9" />
                    <Path d="M9 15c1 1 5 1 6 0" stroke="#0EA5E9" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.biometricBtnText}>Sign In with Face ID / Biometrics</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Clerk Google & Apple Social Authentication */}
            <SocialAuthButtons
              labelPrefix="Sign in with"
              showDivider={true}
              dividerText="or sign in with"
              onSuccess={(details) => {
                actions.signInWithClerk({
                  provider: details.provider,
                  fullName: details.fullName || clerkUser?.fullName || undefined,
                  email: details.email || clerkUser?.primaryEmailAddress?.emailAddress || undefined,
                  avatar: details.avatar || clerkUser?.imageUrl || undefined,
                });
              }}
              onError={(err) => setSignInError(err)}
            />

            {/* Switch to Sign Up */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthPrompt}>Don't have an account yet?</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleTabChange('signup')}
              >
                <Text style={styles.switchAuthLink}> Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* C) SIGN UP FORM (WHEN NOT IN OTP VERIFICATION) */}
      {activeTab === 'signup' && authStep === 'form' && (
        <View style={styles.tabContent}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create Your Health Vault</Text>
            <Text style={styles.formSubtitle}>
              Take full ownership of your records, emergency info, and family coverage.
            </Text>

            {signUpError && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>⚠️ {signUpError}</Text>
              </View>
            )}

            {/* Full Name */}
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              value={signUpData.name}
              onChangeText={(v: string) => setSignUpData({ ...signUpData, name: v })}
              placeholder="e.g. Amara Nwosu"
              placeholderTextColor="#94a3b8"
              style={styles.textInput}
            />

            {/* Email Address */}
            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              value={signUpData.email}
              onChangeText={(v: string) => setSignUpData({ ...signUpData, email: v })}
              placeholder="e.g. amara@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.textInput}
            />

            {/* Phone Number */}
            <Text style={styles.inputLabel}>Phone Number (+234)</Text>
            <TextInput
              value={signUpData.phone}
              onChangeText={(v: string) => setSignUpData({ ...signUpData, phone: v })}
              placeholder="+234 802 000 0000"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              style={styles.textInput}
            />

            {/* Date of Birth */}
            <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              value={signUpData.dob}
              onChangeText={(v: string) => setSignUpData({ ...signUpData, dob: v })}
              placeholder="1990-03-14"
              placeholderTextColor="#94a3b8"
              style={styles.textInput}
            />

            {/* Blood Type & Genotype Grid */}
            <View style={styles.twoColGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Blood Type</Text>
                <FormSelect
                  placeholder="Blood Type"
                  value={signUpData.bloodType || 'O+'}
                  options={BLOOD_TYPES}
                  onChange={(v: string) => setSignUpData({ ...signUpData, bloodType: v })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Genotype</Text>
                <FormSelect
                  placeholder="Genotype"
                  value={signUpData.genotype || 'AA'}
                  options={GENOTYPES}
                  onChange={(v: string) => setSignUpData({ ...signUpData, genotype: v })}
                />
              </View>
            </View>

            {/* HMO / Health Insurance Selector */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.inputLabel}>HMO / Health Insurance Provider</Text>
              <FormSelect
                placeholder="Choose HMO / Health Plan"
                value={signUpData.insuranceProvider}
                options={HMO_PROVIDERS}
                onChange={(v: string) => setSignUpData({ ...signUpData, insuranceProvider: v })}
              />
            </View>

            {/* Insurance ID Number */}
            <Text style={styles.inputLabel}>HMO Policy ID (optional)</Text>
            <TextInput
              value={signUpData.insuranceId}
              onChangeText={(v: string) => setSignUpData({ ...signUpData, insuranceId: v })}
              placeholder="e.g. HYG-984210"
              placeholderTextColor="#94a3b8"
              style={styles.textInput}
            />

            {/* Terms Acceptance Checkbox */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setAgreeTerms(!agreeTerms)}
              style={styles.termsRow}
            >
              <View style={[styles.customCheck, agreeTerms && styles.customCheckActive]}>
                {agreeTerms && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={{ color: '#0EA5E9', fontWeight: '700' }}>Terms of Service</Text> and <Text style={{ color: '#0EA5E9', fontWeight: '700' }}>NDPR Data Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {/* Create Account & Send OTP Submit */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSendOtpSignUp}
              disabled={isSubmitting}
              style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Verify & Create Health Vault ›</Text>
              )}
            </TouchableOpacity>

            {/* Clerk Google & Apple Social Authentication */}
            <SocialAuthButtons
              labelPrefix="Sign up with"
              showDivider={true}
              dividerText="or sign up with"
              onSuccess={(details) => {
                actions.signInWithClerk({
                  provider: details.provider,
                  fullName: details.fullName || clerkUser?.fullName || undefined,
                  email: details.email || clerkUser?.primaryEmailAddress?.emailAddress || undefined,
                  avatar: details.avatar || clerkUser?.imageUrl || undefined,
                });
              }}
              onError={(err) => setSignUpError(err)}
            />

            {/* Switch to Sign In */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthPrompt}>Already have an account?</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleTabChange('signin')}
              >
                <Text style={styles.switchAuthLink}> Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 4. FAQ & SECURITY TAB */}
      {/* ========================================================================= */}
      {activeTab === 'faq' && (
        <View style={styles.tabContent}>
          {/* Security Summary Banner */}
          <View style={styles.securityBanner}>
            <View style={styles.securityBadgeIcon}>
              <Text style={{ fontSize: 24 }}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityBannerTitle}>Bank-Grade Healthcare Encryption</Text>
              <Text style={styles.securityBannerSub}>
                AES-256 bit encryption · NDPR Certified · Zero-Knowledge Patient Architecture
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <View key={item.q} style={styles.faqCard}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticFeedback.light();
                      setExpandedFaq(isExpanded ? null : index);
                    }}
                    style={styles.faqQuestionRow}
                  >
                    <Text style={styles.faqQuestionText}>{item.q}</Text>
                    <Text style={styles.faqChevron}>{isExpanded ? '−' : '+'}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.faqAnswerBox}>
                      <Text style={styles.faqAnswerText}>{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Support & Contact Card */}
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Need Assistance or Enterprise Hospital Integration?</Text>
            <Text style={styles.contactSub}>
              Our medical informatics team is available 24/7.
            </Text>
            <View style={styles.contactRow}>
              <Text style={styles.contactTag}>📧 support@wellirecord.com</Text>
              <Text style={styles.contactTag}>📞 +234 805 335 5504</Text>
            </View>
          </View>
        </View>
      )}

      {/* Footer Strip */}
      <View style={styles.footerStrip}>
        <Text style={styles.footerCopy}>
          © 2026 WelliRecord Technologies Nigeria Ltd. All rights reserved.
        </Text>
        <Text style={styles.footerStatus}>
          ● System Operational · Encrypted End-to-End
        </Text>
      </View>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  countryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  quickDemoBtn: {
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  quickDemoText: {
    color: '#0284c7',
    fontSize: 12.5,
    fontWeight: '800',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  navTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabActive: {
    backgroundColor: '#041E42',
  },
  navTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  navTabTextActive: {
    color: '#ffffff',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  heroBanner: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
  },
  heroBadge: {
    backgroundColor: 'rgba(14,165,233,0.22)',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: '#cbd5e1',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 20,
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  heroPrimaryText: {
    color: '#041E42',
    fontSize: 13.5,
    fontWeight: '800',
  },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  heroSecondaryText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  showcaseSection: {
    marginBottom: 26,
    alignItems: 'center',
    width: '100%',
  },
  showcaseHeader: {
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  showcaseBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  showcaseBadgeText: {
    color: '#0284c7',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  showcaseTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  showcaseSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  screenshotFrame: {
    width: '100%',
    height: 460,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#041E42',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 12,
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
  },
  proofPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  proofPointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proofPointIcon: {
    fontSize: 12,
  },
  proofPointText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  proofPointDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
  },
  howItWorksSection: {
    marginBottom: 26,
    width: '100%',
  },
  comparisonBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    width: '100%',
  },
  comparisonHeader: {
    marginBottom: 14,
  },
  comparisonHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  comparisonSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  compRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  compColumnOld: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  compColTitleRed: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 2,
  },
  compMetricCardRed: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 7,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  compMetricLabelRed: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  compColumnNew: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  compColTitleGreen: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 2,
  },
  compMetricCardGreen: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 7,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  compMetricLabelGreen: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  compItem: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 14.5,
  },
  closerCtaBox: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  closerCtaTitle: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  closerCtaBtn: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  closerCtaBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 18,
    lineHeight: 18,
  },
  quickAccessBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    marginBottom: 18,
  },
  sandboxBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 6,
  },
  sandboxBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.4,
  },
  quickAccessDesc: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
    marginBottom: 10,
  },
  quickAccessTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  demoProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
  },
  demoAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#041E42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  demoProfileName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  demoProfileRole: {
    fontSize: 11.5,
    color: '#64748b',
  },
  demoArrow: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 14,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  authMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  rememberMeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  customCheckActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  rememberMeText: {
    fontSize: 12.5,
    color: '#475569',
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: '#0EA5E9',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 13,
    marginBottom: 18,
  },
  biometricBtnText: {
    color: '#0284c7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  switchAuthPrompt: {
    fontSize: 13,
    color: '#64748b',
  },
  switchAuthLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  twoColGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  termsText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 14,
  },
  errorAlertText: {
    color: '#b91c1c',
    fontSize: 12.5,
    fontWeight: '600',
  },
  securityBanner: {
    backgroundColor: '#041E42',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  securityBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBannerTitle: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 3,
  },
  securityBannerSub: {
    color: '#93c5fd',
    fontSize: 11.5,
    lineHeight: 16,
  },
  faqList: {
    gap: 10,
    marginBottom: 24,
  },
  faqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  faqQuestionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    paddingRight: 10,
  },
  faqChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  faqAnswerBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  faqAnswerText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  contactSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contactTag: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  footerStrip: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  footerCopy: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerStatus: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
  },
  authModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  authModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  authModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  authModeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  authModeBtnTextActive: {
    color: '#041E42',
  },
  otpHeaderBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  otpHeaderBadgeText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 18,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 54,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  otpBoxFilled: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  demoFillBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  demoFillText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 6,
    flexWrap: 'wrap',
  },
  resendText: {
    fontSize: 13,
    color: '#64748b',
  },
  resendTimerText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  resendActionText: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '800',
  },
  backLinkBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 6,
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
