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
import { FormSelect } from '../components/FormSelect';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { useUser, useSSO, useClerk } from '@clerk/expo';
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
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const activeTab: WelcomeTab = state.welcomeTab || 'about';

  const handleSocialOAuth = async (strategy: 'oauth_google' | 'oauth_apple') => {
    const provider = strategy === 'oauth_google' ? 'google' : 'apple';
    hapticFeedback.selection();
    setSocialLoading(provider);

    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        hapticFeedback.success();

        const currentSession = clerk.client?.sessions?.find((s) => s.id === createdSessionId);
        const user = currentSession?.user || clerk.user;
        const email = user?.primaryEmailAddress?.emailAddress || signUp?.emailAddress;
        const fullName = user?.fullName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : undefined);
        const avatar = user?.imageUrl;

        actions.signInWithClerk({
          provider,
          fullName: fullName || undefined,
          email: email || undefined,
          avatar,
        });
      } else if (signUp?.status === 'missing_requirements') {
        actions.signInWithClerk({
          provider,
          email: signUp?.emailAddress || undefined,
          fullName: 'WelliRecord Patient',
        });
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Authentication was interrupted';
      if (!msg.toLowerCase().includes('cancel')) {
        console.error(`[Clerk SSO Error (${provider})]`, err);
        setSignInError(msg);
      }
    } finally {
      setSocialLoading(null);
    }
  };

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
        style={[styles.container, (activeTab === 'signin' || activeTab === 'signup') && { backgroundColor: '#F5F2EA' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header with Dark Ink Background */}
        <View style={styles.darkHeader}>
          <View style={styles.brandRow}>
            <Svg width={26} height={26} viewBox="0 0 40 40" fill="none">
              <Path d="M20 3L34 9V19C34 27.5 28.5 33.8 20 37C11.5 33.8 6 27.5 6 19V9L20 3Z" fill="#3E7CBF" />
              <Path d="M20 3L34 9V19C34 27.5 28.5 33.8 20 37V3Z" fill="#173863" />
              <Path d="M20 15L23.5 21.5H16.5L20 15Z" fill="#F5F2EA" />
            </Svg>
            <Text style={styles.brandText}>
              Welli<Text style={styles.brandTextAccent}>Record</Text>
            </Text>
          </View>

          <View style={styles.flagChip}>
            <View style={styles.flagBars}>
              <View style={[styles.flagBar, { backgroundColor: '#3CA26B' }]} />
              <View style={[styles.flagBar, { backgroundColor: '#F2F0E8' }]} />
              <View style={[styles.flagBar, { backgroundColor: '#3CA26B' }]} />
            </View>
            <Text style={styles.flagText}>Nigeria</Text>
          </View>
        </View>

        {/* Flat Navigation Tabs Bar */}
        <View style={styles.flatTabsBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabChange('about')}
            style={[styles.flatTab, activeTab === 'about' && styles.flatTabActive]}
          >
            <Text style={[styles.flatTabText, activeTab === 'about' && styles.flatTabTextActive]}>
              About
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabChange('signin')}
            style={[styles.flatTab, activeTab === 'signin' && styles.flatTabActive]}
          >
            <Text style={[styles.flatTabText, activeTab === 'signin' && styles.flatTabTextActive]}>
              Sign in
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabChange('signup')}
            style={[styles.flatTab, activeTab === 'signup' && styles.flatTabActive]}
          >
            <Text style={[styles.flatTabText, activeTab === 'signup' && styles.flatTabTextActive]}>
              Create vault
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabChange('faq')}
            style={[styles.flatTab, activeTab === 'faq' && styles.flatTabActive]}
          >
            <Text style={[styles.flatTabText, activeTab === 'faq' && styles.flatTabTextActive]}>
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
        <View style={styles.redesignBody}>
          <View style={styles.otpHeaderBadge}>
            <Text style={styles.otpHeaderBadgeText}>
              {pendingAuth.channel === 'phone' ? '📱 SMS AUTHORIZATION' : '✉️ EMAIL AUTHORIZATION'}
            </Text>
          </View>
          <Text style={styles.welcomeTitle}>Enter 6-Digit Code</Text>
          <Text style={styles.welcomeSub}>
            We dispatched a secure authorization code to{' '}
            <Text style={{ fontWeight: '800', color: '#0B2545' }}>{pendingAuth.identifier}</Text>.
          </Text>

          <View style={[styles.dividerLine, { marginVertical: 18 }]} />

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
            style={[styles.btnPrimary, isSubmitting && { opacity: 0.8 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Verify & Unlock Health Vault</Text>
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

          {/* Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerRow}>
              <View style={styles.statusDot} />
              <Text style={styles.footerText}>
                All systems running · records encrypted end-to-end
              </Text>
            </View>
            <Text style={styles.footerCopyright}>
              © 2026 WelliRecord Technologies Nigeria Ltd.
            </Text>
          </View>
        </View>
      )}

      {/* B) SIGN IN FORM (REDESIGNED) */}
      {activeTab === 'signin' && authStep === 'form' && (
        <View style={styles.redesignBody}>
          {/* Welcome Row with Seal */}
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeTextWrap}>
              <Text style={styles.welcomeTitle}>Welcome back</Text>
              <Text style={styles.welcomeSub}>
                Sign in to reach your records, shares, and family vault.
              </Text>
            </View>
            <View style={styles.sealWrap}>
              <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
                <Circle cx={32} cy={32} r={31} fill="#E7F0EA" stroke="#2F6D4F" strokeWidth={1.5} />
                <Circle cx={32} cy={32} r={24} fill="none" stroke="#2F6D4F" strokeWidth={1} strokeDasharray="2 3" />
                <Path d="M23 32.5L28.5 38L41 24" stroke="#2F6D4F" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>

          <View style={styles.dividerLine} />

          {signInError && (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>⚠️ {signInError}</Text>
            </View>
          )}

          {/* Identifier Input */}
          <View style={styles.inputWrap}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.fieldLabel}>Phone number or email</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  hapticFeedback.selection();
                  setSignInMethod(signInMethod === 'password' ? 'otp' : 'password');
                  setSignInError(null);
                }}
              >
                <Text style={styles.methodToggleText}>
                  {signInMethod === 'password' ? 'Use code instead' : 'Use password instead'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              placeholder="+234 805 335 5504 or name@email.com"
              placeholderTextColor="#A5AAB3"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.textInputRedesign}
            />
          </View>

          {signInMethod === 'password' && (
            <View style={styles.inputWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrapperRedesign}>
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Enter your vault password"
                  placeholderTextColor="#A5AAB3"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInputRedesign}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Text style={{ fontSize: 13, color: '#3E7CBF', fontWeight: '600' }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>

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
            </View>
          )}

          {/* Primary CTA: Send sign-in code or Sign in with Password */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={signInMethod === 'password' ? handlePasswordSignIn : handleSendOtpSignIn}
            disabled={isSubmitting}
            style={[styles.btnPrimary, isSubmitting && { opacity: 0.8 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.btnPrimaryText}>
                  {signInMethod === 'password' ? 'Sign In to Vault' : 'Send sign-in code'}
                </Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </>
            )}
          </TouchableOpacity>

          {/* Ghost Secondary Button: Use Face ID instead */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBiometricSignIn}
            disabled={authenticatingBio}
            style={styles.btnGhost}
          >
            {authenticatingBio ? (
              <ActivityIndicator color="#173863" size="small" />
            ) : (
              <>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3Z" stroke="#173863" strokeWidth={1.6} />
                  <Circle cx={12} cy={17.5} r={0.9} fill="#173863" />
                </Svg>
                <Text style={styles.btnGhostText}>Use Face ID instead</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Or continue with divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>Or continue with</Text>
            <View style={styles.orLine} />
          </View>

          {/* Social Row (Google & Apple) */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSocialOAuth('oauth_google')}
              disabled={socialLoading !== null}
              style={styles.btnSocial}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator size="small" color="#0B2545" />
              ) : (
                <>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                    <Path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
                    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </Svg>
                  <Text style={styles.btnSocialText}>Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSocialOAuth('oauth_apple')}
              disabled={socialLoading !== null}
              style={styles.btnSocial}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator size="small" color="#0B2545" />
              ) : (
                <>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="#1B1F27">
                    <Path d="M16.36 1.7c.1 1.07-.32 2.1-.99 2.87-.7.8-1.85 1.42-2.94 1.34-.13-1.03.36-2.1 1.02-2.83.72-.8 1.94-1.4 2.91-1.38zM20.4 17.1c-.34.8-.75 1.55-1.24 2.24-.68.95-1.24 1.6-1.67 1.96-.66.6-1.37.9-2.12.92-.55.01-1.21-.15-1.98-.48-.77-.33-1.48-.49-2.13-.49-.68 0-1.4.16-2.17.49-.77.33-1.4.5-1.88.52-.72.03-1.44-.28-2.16-.94-.46-.4-1.05-1.08-1.77-2.04-.77-1.04-1.4-2.24-1.9-3.62-.53-1.5-.8-2.94-.8-4.34 0-1.6.35-2.98 1.04-4.13a6.1 6.1 0 0 1 2.19-2.23 5.9 5.9 0 0 1 2.96-.84c.6 0 1.38.19 2.36.55.97.36 1.6.55 1.86.55.2 0 .89-.21 2.06-.63 1.11-.39 2.05-.55 2.82-.49 2.08.17 3.65 1 4.68 2.47-1.86 1.13-2.78 2.71-2.76 4.75.02 1.59.6 2.92 1.72 3.97.51.49 1.08.86 1.71 1.13-.14.4-.28.78-.44 1.15z"/>
                  </Svg>
                  <Text style={styles.btnSocialText}>Apple</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Create Account Link */}
          <View style={styles.createRow}>
            <Text style={styles.createText}>
              Don't have an account yet?{' '}
              <Text
                style={styles.createLink}
                onPress={() => handleTabChange('signup')}
              >
                Create one
              </Text>
            </Text>
          </View>

          {/* Redesigned Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerRow}>
              <View style={styles.statusDot} />
              <Text style={styles.footerText}>
                All systems running · records encrypted end-to-end
              </Text>
            </View>
            <Text style={styles.footerCopyright}>
              © 2026 WelliRecord Technologies Nigeria Ltd.
            </Text>
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
  darkHeader: {
    backgroundColor: '#0B2545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 14,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  brandTextAccent: {
    color: '#8FB8E0',
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  flagBars: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  flagBar: {
    width: 4,
    height: 11,
    borderRadius: 1,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CBD9E8',
  },
  flatTabsBar: {
    backgroundColor: '#0B2545',
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  flatTab: {
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  flatTabActive: {
    borderBottomColor: '#3E7CBF',
  },
  flatTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8598B3',
  },
  flatTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* Redesigned Sign In Body */
  redesignBody: {
    flex: 1,
    backgroundColor: '#F5F2EA',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  welcomeTextWrap: {
    flex: 1,
    maxWidth: 240,
  },
  welcomeTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '600',
    fontSize: 26,
    lineHeight: 32,
    color: '#0B2545',
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 13.5,
    color: '#6B7280',
    lineHeight: 20,
  },
  sealWrap: {
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E4DFD1',
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B2545',
    marginBottom: 8,
  },
  methodToggleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3E7CBF',
  },
  inputWrap: {
    marginBottom: 16,
  },
  textInputRedesign: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E4DFD1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    color: '#1B1F27',
  },
  passwordWrapperRedesign: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E4DFD1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  passwordInputRedesign: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14.5,
    color: '#1B1F27',
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#0B2545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  btnGhost: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E4DFD1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  btnGhostText: {
    color: '#173863',
    fontSize: 14.5,
    fontWeight: '600',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4DFD1',
  },
  orText: {
    fontSize: 12.5,
    color: '#6B7280',
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  btnSocial: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E4DFD1',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSocialText: {
    color: '#1B1F27',
    fontSize: 13.5,
    fontWeight: '600',
  },
  createRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  createText: {
    fontSize: 13.5,
    color: '#6B7280',
    textAlign: 'center',
  },
  createLink: {
    color: '#3E7CBF',
    fontWeight: '600',
  },
  footerWrap: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E4DFD1',
    marginTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2F6D4F',
  },
  footerText: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '500',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#9AA0A8',
    marginTop: 2,
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
