import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import { EXPIRY_LABEL_MAP } from '../utils/expiry';
import { normalizeNigerianPhone } from '../utils/phone';
import { authService } from '../services/authService';
import { facilityService } from '../services/facilityService';
import { CONFIG } from '../services/config';
import type { WelliApp } from '../state/useWelliApp';
import type { ShareExpiry } from '../data/types';

const EXPIRY_DEFS: [ShareExpiry, string, string?][] = [
  ['24h', '24 Hours', 'Emergency'],
  ['7d', '7 Days', 'Suggested'],
  ['30d', '30 Days', 'Episode'],
  ['custom', '90 Days', 'Extended'],
];

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
}

function maskEmail(email: string): string {
  const [name, domain] = (email || '').split('@');
  if (!name || !domain) return email || '';
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
}

export function SmartConsentModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, consentScopes, family } = app;

  // Live facilities (replaces hardcoded PRESET_ORGS)
  const [presetOrgs, setPresetOrgs] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!state.showSmartConsent) return;
    facilityService.fetchFacilities().then((list: any[]) =>
      setPresetOrgs((list || []).map((f) => ({ id: f.id || f._id, name: f.name })))
    );
  }, [state.showSmartConsent]);

  // OTP gate state (mirrors ShareFlowModal)
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpChannel, setOtpChannel] = useState<'phone' | 'email'>('phone');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [dispatchState, setDispatchState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const otpInputsRef = useRef<Array<TextInput | null>>([]);

  const currentUser = family.find((f) => f.id === 'me') ?? family[0];
  const userPhone = normalizeNigerianPhone(currentUser?.phone || state.user?.phoneNumber || '');
  const userEmail = currentUser?.email || state.user?.email || '';

  const isCodeComplete = otpDigits.every((d) => d.length > 0);

  const handleClose = () => {
    setStep('form');
    setOtpDigits(['', '', '', '', '', '']);
    setDispatchState('idle');
    setDispatchError(null);
    actions.closeSmartConsent();
  };

  useEffect(() => {
    if (resendCooldown > 0 && step === 'otp') {
      const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
      return () => clearInterval(t);
    }
  }, [resendCooldown, step]);

  if (!state.showSmartConsent) return null;

  const isOrg = state.consentGranteeType === 'organization';

  const handleSelectPresetOrg = (org: { id: string; name: string }) => {
    hapticFeedback.selection();
    actions.setConsentProviderId(org.name);
  };

  const triggerDispatch = async (channel: 'phone' | 'email') => {
    if (CONFIG.demoMode) {
      setDispatchState('sent');
      setDispatchMessage('Verification code dispatched (demo mode)');
      return;
    }
    setDispatchState('sending');
    setDispatchError(null);
    try {
      if (channel === 'phone') {
        if (!userPhone) throw new Error('No phone number on file for this account');
        const res = await authService.sendPhoneOtp(userPhone);
        setDispatchState('sent');
        setDispatchMessage(res.message || `Security code dispatched to ${maskPhone(userPhone)}`);
      } else {
        if (!userEmail) throw new Error('No email on file for this account');
        const res = await authService.sendEmailOtp(userEmail);
        setDispatchState('sent');
        setDispatchMessage(res.message || `Security code dispatched to ${maskEmail(userEmail)}`);
      }
    } catch (err: any) {
      setDispatchState('error');
      setDispatchError(err?.message || 'Failed to connect to backend OTP gateway');
    }
  };

  const handleRequestGrant = () => {
    if (!state.consentProviderId.trim()) {
      actions.showToast('Please enter or select a recipient');
      return;
    }
    if (!state.consentScope) {
      actions.showToast('Please choose an access scope');
      return;
    }
    hapticFeedback.selection();
    setStep('otp');
    setOtpDigits(['', '', '', '', '', '']);
    setResendCooldown(30);
    triggerDispatch(otpChannel);
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const next = [...otpDigits];
    if (cleaned.length > 1) {
      cleaned.slice(0, 6).split('').forEach((c, i) => {
        if (index + i < 6) next[index + i] = c;
      });
      setOtpDigits(next);
      return;
    }
    next[index] = cleaned;
    setOtpDigits(next);
    if (cleaned && index < 5) otpInputsRef.current[index + 1]?.focus();
  };

  const handleOtpBackspace = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerifyAndGrant = async () => {
    if (!isCodeComplete) return;
    setVerifying(true);
    try {
      const code = otpDigits.join('');
      const identifier = otpChannel === 'phone' ? userPhone : userEmail;
      if (!CONFIG.demoMode) {
        // Verifies identity only — does not alter account session
        await authService.verifyAuthOtp(identifier, code);
      }
      hapticFeedback.success();
      await actions.grantSmartAccess();
      setStep('form');
    } catch (err: any) {
      actions.showToast(err?.message || 'Verification failed. Check the code and try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      visible={state.showSmartConsent}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader
          title={step === 'otp' ? "Verify It's You" : 'Smart Consent Controls'}
          onClose={handleClose}
          onBack={step === 'otp' ? () => setStep('form') : handleClose}
        />

        {step === 'form' ? (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: theme.darkMode
                    ? 'rgba(14,165,233,0.08)'
                    : '#EEF4FF',
                  borderColor: theme.darkMode
                    ? 'rgba(14,165,233,0.25)'
                    : '#DBEAFE',
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>🔐</Text>
              <Text
                style={[
                  styles.infoBannerText,
                  { color: theme.darkMode ? '#7dd3fc' : '#1E3A8A' },
                ]}
              >
                Grant cryptographic, time-bound access to a verified hospital or attending physician under NDPR guidelines.
              </Text>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Grantee Type</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  actions.setConsentGranteeType('individual');
                }}
                style={[
                  styles.segmentBtn,
                  !isOrg
                    ? { backgroundColor: '#041E42', borderColor: '#041E42' }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={{ fontSize: 15 }}>👨‍⚕️</Text>
                <Text
                  style={[
                    styles.segmentBtnText,
                    { color: !isOrg ? '#FFFFFF' : theme.text },
                  ]}
                >
                  Individual Doctor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  actions.setConsentGranteeType('organization');
                }}
                style={[
                  styles.segmentBtn,
                  isOrg
                    ? { backgroundColor: '#041E42', borderColor: '#041E42' }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={{ fontSize: 15 }}>🏥</Text>
                <Text
                  style={[
                    styles.segmentBtnText,
                    { color: isOrg ? '#FFFFFF' : theme.text },
                  ]}
                >
                  Healthcare Facility
                </Text>
              </TouchableOpacity>
            </View>

            {isOrg && (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.fieldSubLabel, { color: theme.mutedLight }]}>
                  VERIFIED WELLIRECORD PARTNERS
                </Text>
                {presetOrgs.length === 0 ? (
                  <Text style={{ fontSize: 12, color: theme.mutedLight, paddingVertical: 4 }}>
                    Loading verified partner facilities...
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                    {presetOrgs.map((org) => {
                      const isSelected = state.consentProviderId === org.name;
                      return (
                        <TouchableOpacity
                          key={org.id}
                          activeOpacity={0.7}
                          onPress={() => handleSelectPresetOrg(org)}
                          style={[
                            styles.presetChip,
                            isSelected
                              ? { backgroundColor: '#059669', borderColor: '#059669' }
                              : { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {org.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              {isOrg ? 'Organization / Facility Name' : 'Doctor Name or MDCN ID'}
            </Text>
            <TextInput
              value={state.consentProviderId}
              onChangeText={actions.setConsentProviderId}
              placeholder={
                isOrg
                  ? 'e.g. Wellicare Hospital & Medical Center'
                  : 'e.g. Dr. Josh Uche or MDCN-88102'
              }
              placeholderTextColor={theme.mutedLight}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Clinical Access Scope</Text>
            <View style={styles.gridTwo}>
              {consentScopes.map((scope) => {
                const selected = state.consentScope === scope;
                return (
                  <TouchableOpacity
                    key={scope}
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticFeedback.selection();
                      actions.setConsentScope(scope);
                    }}
                    style={[
                      styles.scopeCard,
                      {
                        backgroundColor: selected
                          ? theme.darkMode
                            ? 'rgba(16,185,129,0.15)'
                            : '#ECFDF5'
                          : theme.surface,
                        borderColor: selected ? '#10B981' : theme.border,
                      },
                    ]}
                  >
                    <View style={styles.scopeCardHeader}>
                      <Text style={styles.scopeIcon}>
                        {scope === 'All' ? '🗂️' : scope === 'Lab Results' ? '🧪' : scope === 'Prescriptions' ? '💊' : '📋'}
                      </Text>
                      {selected && (
                        <View style={styles.checkPill}>
                          <Text style={styles.checkPillText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.scopeLabel,
                        { color: selected ? '#059669' : theme.text },
                      ]}
                    >
                      {scope}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticFeedback.selection();
                actions.toggleConsentWrite();
              }}
              style={[
                styles.writeAccessCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: state.consentAllowWrite ? '#059669' : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.writeCheckbox,
                  {
                    borderColor: state.consentAllowWrite ? '#059669' : theme.border,
                    backgroundColor: state.consentAllowWrite ? '#059669' : 'transparent',
                  },
                ]}
              >
                {state.consentAllowWrite && (
                  <Svg width={12} height={12} viewBox="0 0 20 20">
                    <Path
                      d="M4 10l4 4 8-9"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.writeTitle, { color: theme.text }]}>
                  Allow Provider Write Access
                </Text>
                <Text style={[styles.writeSub, { color: theme.muted }]}>
                  Allows this facility to upload verified lab reports, prescriptions, and encounter discharge summaries directly into your vault.
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Auto-Expire Duration</Text>
            <View style={styles.gridTwo}>
              {EXPIRY_DEFS.map(([val, label, badge]) => {
                const selected = state.consentExpiry === val;
                return (
                  <TouchableOpacity
                    key={val}
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticFeedback.selection();
                      actions.setConsentExpiry(val);
                    }}
                    style={[
                      styles.expiryCard,
                      {
                        backgroundColor: selected ? '#059669' : theme.surface,
                        borderColor: selected ? '#059669' : theme.border,
                      },
                    ]}
                  >
                    {badge && (
                      <View
                        style={[
                          styles.badgeTag,
                          {
                            backgroundColor: selected
                              ? 'rgba(255,255,255,0.25)'
                              : '#0EA5E9',
                          },
                        ]}
                      >
                        <Text style={styles.badgeTagText}>{badge}</Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.expiryLabel,
                        { color: selected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.expireNotice, { color: theme.mutedLight }]}>
              Access automatically terminates after {EXPIRY_LABEL_MAP[state.consentExpiry]}.
            </Text>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Clinical Purpose</Text>
            <TextInput
              value={state.consentPurpose}
              onChangeText={actions.setConsentPurpose}
              placeholder="e.g. Cardiology review, emergency admission, second opinion..."
              placeholderTextColor={theme.mutedLight}
              multiline
              numberOfLines={3}
              style={[
                styles.textInput,
                styles.textArea,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleRequestGrant}
              style={styles.grantBtn}
            >
              <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
                <Path
                  d="M10 2a8 8 0 100 16 8 8 0 000-16zm-1 11l-3-3 1.41-1.41L10 11.17l4.59-4.58L16 8l-7 5z"
                  fill="#ffffff"
                />
              </Svg>
              <Text style={styles.grantBtnText}>Continue to Verification</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.sectionHeading,
                { color: theme.text, textAlign: 'center', marginTop: 12 },
              ]}
            >
              Confirm it's really you before granting {state.consentProviderId || 'this recipient'} access
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 16 }}>
              <TouchableOpacity
                disabled={!userPhone}
                activeOpacity={0.8}
                onPress={() => {
                  setOtpChannel('phone');
                  triggerDispatch('phone');
                }}
                style={[
                  styles.segmentBtn,
                  otpChannel === 'phone'
                    ? { backgroundColor: '#041E42', borderColor: '#041E42' }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                  !userPhone && { opacity: 0.4 },
                ]}
              >
                <Text style={{ fontSize: 15 }}>📱</Text>
                <Text
                  style={[
                    styles.segmentBtnText,
                    { color: otpChannel === 'phone' ? '#fff' : theme.text },
                  ]}
                >
                  {maskPhone(userPhone) || 'No phone on file'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!userEmail}
                activeOpacity={0.8}
                onPress={() => {
                  setOtpChannel('email');
                  triggerDispatch('email');
                }}
                style={[
                  styles.segmentBtn,
                  otpChannel === 'email'
                    ? { backgroundColor: '#041E42', borderColor: '#041E42' }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                  !userEmail && { opacity: 0.4 },
                ]}
              >
                <Text style={{ fontSize: 15 }}>✉️</Text>
                <Text
                  style={[
                    styles.segmentBtnText,
                    { color: otpChannel === 'email' ? '#fff' : theme.text },
                  ]}
                >
                  {maskEmail(userEmail) || 'No email on file'}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {otpDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => {
                    otpInputsRef.current[i] = el;
                  }}
                  value={digit}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  style={{
                    width: 44,
                    height: 50,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: digit ? '#059669' : theme.border,
                    backgroundColor: theme.surface,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: '800',
                    color: theme.text,
                  }}
                />
              ))}
            </View>

            {dispatchState === 'sending' && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={{ fontSize: 12, color: theme.muted }}>
                  Dispatching security code...
                </Text>
              </View>
            )}
            {dispatchState === 'sent' && dispatchMessage && (
              <Text
                style={{
                  fontSize: 12,
                  color: '#059669',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                ✓ {dispatchMessage}
              </Text>
            )}
            {dispatchState === 'error' && dispatchError && (
              <Text
                style={{
                  fontSize: 12,
                  color: '#dc2626',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {dispatchError}
              </Text>
            )}

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {resendCooldown > 0 ? (
                <Text style={{ fontSize: 12, color: theme.mutedLight }}>
                  Resend code in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setResendCooldown(30);
                    triggerDispatch(otpChannel);
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700' }}>
                    Resend Code
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!isCodeComplete || verifying}
              onPress={handleVerifyAndGrant}
              style={[
                styles.grantBtn,
                (!isCodeComplete || verifying) && { opacity: 0.5 },
              ]}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
                    <Path
                      d="M10 2a8 8 0 100 16 8 8 0 000-16zm-1 11l-3-3 1.41-1.41L10 11.17l4.59-4.58L16 8l-7 5z"
                      fill="#ffffff"
                    />
                  </Svg>
                  <Text style={styles.grantBtnText}>Verify & Grant Consent</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  infoBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoBannerText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  fieldSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  scopeCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scopeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scopeIcon: {
    fontSize: 18,
  },
  checkPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  scopeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  writeAccessCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  writeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  writeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  writeSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  expiryCard: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeTag: {
    position: 'absolute',
    top: -6,
    right: 8,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeTagText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
  },
  expiryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  expireNotice: {
    fontSize: 11.5,
    marginBottom: 20,
    marginTop: -8,
  },
  grantBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  grantBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
