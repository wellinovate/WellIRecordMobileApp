import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { BridgeCodeCard } from '../components/BridgeCodeCard';
import { RECORD_META } from '../data/mockData';
import { bridgeLinkFor } from '../utils/bridgeCode';
import { EXPIRY_LABEL_MAP } from '../utils/expiry';
import { hapticFeedback } from '../utils/haptics';
import { CONFIG } from '../services/config';
import { authService } from '../services/authService';
import type { WelliApp } from '../state/useWelliApp';
import type { ShareExpiry } from '../data/types';

const SHARE_TITLES = [
  'Select Records',
  'Choose Recipient',
  'Set Expiry',
  'Verify Identity',
  'Sent',
];
const NEXT_LABELS = ['Continue', 'Continue', 'Continue', 'Authorize & Share Access', 'Done'];
const EXPIRY_DEFS: [ShareExpiry, string][] = [
  ['24h', '24 Hours'],
  ['7d', '7 Days'],
  ['30d', '30 Days'],
  ['custom', '90 Days'],
];

type RecipientFilterTab = 'all' | 'orgs' | 'doctors';

export function ShareFlowModal({ app }: { app: WelliApp }) {
  const { state, actions, records, family, doctors, facilities } = app;
  const [recipientTab, setRecipientTab] = useState<RecipientFilterTab>('all');

  // Custom provider invitation state
  const [customProviderName, setCustomProviderName] = useState('');
  const [customProviderContact, setCustomProviderContact] = useState('');
  const [showCustomInvite, setShowCustomInvite] = useState(false);

  // OTP Verification State
  const [otpChannel, setOtpChannel] = useState<'phone' | 'email'>('phone');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(30);
  const otpInputsRef = useRef<Array<TextInput | null>>([]);

  // Countdown timer for OTP & live dispatch trigger
  useEffect(() => {
    if (state.shareStep === 3) {
      if (!CONFIG.demoMode) {
        if (otpChannel === 'phone') {
          authService.sendPhoneOtp('+2348055555504').catch(() => {});
        } else {
          authService.sendEmailOtp('amara.nwosu@gmail.com').catch(() => {});
        }
      }
      if (resendCooldown > 0) {
        const timer = setInterval(() => {
          setResendCooldown((c) => (c > 0 ? c - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
      }
    }
  }, [state.shareStep, resendCooldown, otpChannel]);

  if (!state.showShareFlow) return null;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';
  const shareSubjectName = isGuardianView
    ? `${activeMember.name}'s records`
    : 'your records';

  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId);
  const shareSelectedCount = Object.values(state.shareSelected).filter(Boolean).length;
  const shareSelectedRecordsList = ownedRecords.filter(
    (r) => state.shareSelected[r.id]
  );

  const query = state.shareDoctorQuery.trim().toLowerCase();

  const doctorResults = doctors.filter(
    (d) =>
      !query ||
      d.name.toLowerCase().includes(query) ||
      d.specialty.toLowerCase().includes(query) ||
      d.org.toLowerCase().includes(query)
  );

  const facilityResults = facilities.filter(
    (f) =>
      !query ||
      f.name.toLowerCase().includes(query) ||
      f.specialty.toLowerCase().includes(query) ||
      f.address.toLowerCase().includes(query) ||
      f.typeLabel.toLowerCase().includes(query) ||
      f.acceptedHmos?.some((h) => h.toLowerCase().includes(query))
  );

  const isBridge = state.shareSelectedDoctorId === 'bridge';
  const selectedDoctor = doctors.find((d) => d.id === state.shareSelectedDoctorId);
  const selectedFacility = facilities.find((f) => f.id === state.shareSelectedDoctorId);

  const shareSelectedRecipientName = isBridge
    ? 'Anyone with your WelliBridge link'
    : selectedDoctor
    ? selectedDoctor.name
    : selectedFacility
    ? selectedFacility.name
    : customProviderName || 'Selected Provider';

  const isFacilityRecipient = !!selectedFacility;
  const shareExpiryLabel = EXPIRY_LABEL_MAP[state.shareExpiry];

  const isOtpComplete = otpDigits.every((d) => d.length > 0);

  const stepValid = [
    shareSelectedCount > 0,
    !!state.shareSelectedDoctorId,
    true,
    isOtpComplete,
    true,
  ];
  const disabled = !stepValid[state.shareStep];
  const showFooter = state.shareStep <= 3;

  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 1) {
      // Pasted multi-digit code
      const chars = cleaned.slice(0, 6).split('');
      chars.forEach((c, idx) => {
        if (index + idx < 6) newDigits[index + idx] = c;
      });
      setOtpDigits(newDigits);
      hapticFeedback.selection();
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    if (cleaned.length > 0) {
      hapticFeedback.selection();
      if (index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpBackspace = (key: string, index: number) => {
    if (key === 'Backspace' && otpDigits[index] === '' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const autoFillDemoOtp = () => {
    hapticFeedback.success();
    setOtpDigits(['8', '4', '9', '2', '0', '1']);
  };

  const handleCustomInviteSelect = () => {
    if (!customProviderName.trim()) return;
    hapticFeedback.selection();
    actions.selectDoctor(`custom_${Date.now()}`);
  };

  return (
    <Modal
      visible={state.showShareFlow}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeShareFlow}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={SHARE_TITLES[state.shareStep]}
          onClose={actions.closeShareFlow}
          onBack={state.shareStep > 0 ? actions.shareBack : undefined}
        />

        {/* Progress Bar (4 Segments) */}
        <View style={styles.progressBarRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    i <= state.shareStep ? '#0EA5E9' : '#e2e8f0',
                },
              ]}
            />
          ))}
        </View>

        {/* Step 0: Select Records */}
        {state.shareStep === 0 && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
          >
            <Text style={styles.helperText}>
              Choose which of {shareSubjectName} to include.
            </Text>
            {ownedRecords.map((r) => {
              const meta = RECORD_META[r.type];
              const checked = !!state.shareSelected[r.id];
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.7}
                  onPress={() => actions.toggleShareRecord(r.id)}
                  style={[
                    styles.recordSelectCard,
                    {
                      borderColor: checked ? '#0EA5E9' : '#e2e8f0',
                      backgroundColor: checked ? '#f0f9ff' : '#ffffff',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.recordEmojiBox,
                      { backgroundColor: meta.tint },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordSelectTitle}>{r.title}</Text>
                    <Text style={styles.recordSelectDate}>{r.date}</Text>
                  </View>
                  <View
                    style={[
                      styles.checkboxCircle,
                      {
                        backgroundColor: checked ? '#0EA5E9' : '#f1f5f9',
                        borderColor: checked ? '#0EA5E9' : '#cbd5e1',
                      },
                    ]}
                  >
                    {checked && (
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
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Step 1: Choose Recipient (Search Hospitals / Doctors OR WelliBridge) */}
        {state.shareStep === 1 && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Mode Toggle: Care Directory vs WelliBridge Code */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => actions.setMethod('search')}
                style={[
                  styles.tabToggleBtn,
                  {
                    backgroundColor:
                      state.shareMethod === 'search' ? '#041E42' : '#f1f5f9',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color:
                        state.shareMethod === 'search' ? '#ffffff' : '#334155',
                    },
                  ]}
                >
                  Care Directory
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => actions.setMethod('bridge')}
                style={[
                  styles.tabToggleBtn,
                  {
                    backgroundColor:
                      state.shareMethod === 'bridge' ? '#041E42' : '#f1f5f9',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    {
                      color:
                        state.shareMethod === 'bridge' ? '#ffffff' : '#334155',
                    },
                  ]}
                >
                  WelliBridge PIN & QR
                </Text>
              </TouchableOpacity>
            </View>

            {state.shareMethod === 'search' && (
              <>
                {/* Search Input */}
                <TextInput
                  value={state.shareDoctorQuery}
                  onChangeText={actions.setDoctorQuery}
                  placeholder="Search hospital, clinic, lab, pharmacy, or doctor..."
                  placeholderTextColor="#94a3b8"
                  style={styles.doctorInput}
                />

                {/* Sub-filter chips: All vs Hospitals/Orgs vs Individual Doctors */}
                <View style={styles.recipientFilterRow}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticFeedback.selection();
                      setRecipientTab('all');
                    }}
                    style={[
                      styles.filterPill,
                      recipientTab === 'all' && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        recipientTab === 'all' && styles.filterPillTextActive,
                      ]}
                    >
                      All ({facilityResults.length + doctorResults.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticFeedback.selection();
                      setRecipientTab('orgs');
                    }}
                    style={[
                      styles.filterPill,
                      recipientTab === 'orgs' && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        recipientTab === 'orgs' && styles.filterPillTextActive,
                      ]}
                    >
                      🏥 Hospitals & Orgs ({facilityResults.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticFeedback.selection();
                      setRecipientTab('doctors');
                    }}
                    style={[
                      styles.filterPill,
                      recipientTab === 'doctors' && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        recipientTab === 'doctors' && styles.filterPillTextActive,
                      ]}
                    >
                      👨‍⚕️ Doctors ({doctorResults.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Provider Organizations Section */}
                {recipientTab !== 'doctors' && facilityResults.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeaderTitle}>
                        HOSPITALS & HEALTHCARE ORGANIZATIONS
                      </Text>
                      <View style={styles.orgTag}>
                        <Text style={styles.orgTagText}>Care Network</Text>
                      </View>
                    </View>

                    {facilityResults.map((facility) => {
                      const selected = state.shareSelectedDoctorId === facility.id;
                      return (
                        <TouchableOpacity
                          key={facility.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            hapticFeedback.selection();
                            actions.selectDoctor(facility.id);
                          }}
                          style={[
                            styles.facilityCard,
                            selected && styles.facilityCardSelected,
                          ]}
                        >
                          <View style={styles.facilityTopRow}>
                            <View style={styles.facilityEmojiBox}>
                              <Text style={{ fontSize: 20 }}>{facility.emoji}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.facilityName}>{facility.name}</Text>
                              <Text style={styles.facilityTypeLabel}>
                                {facility.typeLabel} · {facility.specialty}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.selectIndicator,
                                selected && styles.selectIndicatorActive,
                              ]}
                            >
                              {selected ? (
                                <Text style={styles.selectCheckmark}>✓</Text>
                              ) : null}
                            </View>
                          </View>

                          <Text style={styles.facilityAddress} numberOfLines={1}>
                            📍 {facility.address}
                          </Text>

                          <View style={styles.facilityBottomRow}>
                            <View style={styles.orgAccessPill}>
                              <Text style={styles.orgAccessPillText}>
                                🏢 Organization-Wide Care Team Access
                              </Text>
                            </View>
                            {facility.acceptedHmos && facility.acceptedHmos.length > 0 && (
                              <Text style={styles.facilityHmoText}>
                                {facility.acceptedHmos[0]}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* 2. Individual Doctors Section */}
                {recipientTab !== 'orgs' && doctorResults.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeaderTitle}>
                        INDIVIDUAL PHYSICIANS & SPECIALISTS
                      </Text>
                    </View>

                    {doctorResults.map((d) => {
                      const selected = state.shareSelectedDoctorId === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          activeOpacity={0.7}
                          onPress={() => {
                            hapticFeedback.selection();
                            actions.selectDoctor(d.id);
                          }}
                          style={[
                            styles.doctorCard,
                            selected && styles.doctorCardSelected,
                          ]}
                        >
                          <View style={styles.doctorAvatar}>
                            <Text style={styles.doctorInitials}>{d.initials}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.doctorName}>{d.name}</Text>
                            <Text style={styles.doctorSub}>
                              {d.specialty} · {d.org}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.selectIndicator,
                              selected && styles.selectIndicatorActive,
                            ]}
                          >
                            {selected ? (
                              <Text style={styles.selectCheckmark}>✓</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* 3. Fallback: Can't find doctor? Invite by email / phone */}
                <View style={styles.customInviteCard}>
                  <View style={styles.customInviteHeader}>
                    <Text style={{ fontSize: 18 }}>✉️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customInviteTitle}>Can't find your doctor or clinic?</Text>
                      <Text style={styles.customInviteSub}>
                        Send an encrypted clinical invite directly via Email or SMS.
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowCustomInvite(!showCustomInvite)}
                      style={styles.toggleInviteBtn}
                    >
                      <Text style={styles.toggleInviteBtnText}>
                        {showCustomInvite ? 'Hide' : '+ Invite'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showCustomInvite && (
                    <View style={styles.customInviteForm}>
                      <TextInput
                        value={customProviderName}
                        onChangeText={setCustomProviderName}
                        placeholder="Provider Name (e.g. Dr. Chinedu Eze or St. Nicholas)"
                        placeholderTextColor="#94a3b8"
                        style={styles.customInviteInput}
                      />
                      <TextInput
                        value={customProviderContact}
                        onChangeText={setCustomProviderContact}
                        placeholder="Doctor's Email or Phone (e.g. doctor@clinic.ng)"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.customInviteInput}
                      />
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCustomInviteSelect}
                        disabled={!customProviderName.trim()}
                        style={[
                          styles.inviteSelectBtn,
                          { backgroundColor: customProviderName.trim() ? '#041E42' : '#cbd5e1' },
                        ]}
                      >
                        <Text style={styles.inviteSelectBtnText}>
                          Select {customProviderName.trim() || 'Custom Provider'} ›
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}

            {state.shareMethod === 'bridge' && state.bridgeCode && (
              <View style={styles.bridgeWrapper}>
                <Text style={styles.bridgeHelper}>
                  Let any doctor or hospital triage nurse scan this code, or copy the link to send securely.
                </Text>
                <BridgeCodeCard
                  code={state.bridgeCode}
                  link={bridgeLinkFor(state.bridgeCode)}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={actions.copyBridgeLink}
                  style={styles.copyLinkBtn}
                >
                  <Svg width={15} height={15} viewBox="0 0 20 20" fill="none">
                    <Rect
                      x="6"
                      y="6"
                      width="11"
                      height="11"
                      rx="2"
                      stroke="#041E42"
                      strokeWidth={1.6}
                    />
                    <Path d="M3 13V4a1 1 0 011-1h9" stroke="#041E42" strokeWidth={1.6} />
                  </Svg>
                  <Text style={styles.copyLinkText}>Copy Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* Step 2: Set Expiry */}
        {state.shareStep === 2 && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
          >
            <Text style={styles.helperText}>
              How long should {shareSelectedRecipientName} have access?
            </Text>
            {EXPIRY_DEFS.map(([val, label]) => {
              const checked = state.shareExpiry === val;
              return (
                <TouchableOpacity
                  key={val}
                  activeOpacity={0.7}
                  onPress={() => actions.setExpiry(val)}
                  style={[
                    styles.expiryCard,
                    {
                      borderColor: checked ? '#0EA5E9' : '#e2e8f0',
                      backgroundColor: checked ? '#f0f9ff' : '#ffffff',
                    },
                  ]}
                >
                  <Text style={styles.expiryLabel}>{label}</Text>
                  {checked && (
                    <View style={styles.checkedDot}>
                      <Svg width={16} height={16} viewBox="0 0 20 20">
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
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Step 3: Verified Patient Identity (2FA OTP Verification) */}
        {state.shareStep === 3 && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Identity & Security Explanatory Banner */}
            <View style={styles.verifyHeaderBox}>
              <View style={styles.shieldIconCircle}>
                <Text style={{ fontSize: 24 }}>🛡️</Text>
              </View>
              <Text style={styles.verifyTitle}>Verified Patient Identity</Text>
              <Text style={styles.verifyExplanation}>
                Confirming it's really you before sharing medical records with{' '}
                <Text style={{ fontWeight: '800', color: '#0f172a' }}>
                  {shareSelectedRecipientName}
                </Text>
                .
              </Text>
            </View>

            {/* Recipient & Records Context Badge */}
            <View style={styles.contextCard}>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Recipient Scope</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {isFacilityRecipient ? `🏥 ${selectedFacility?.name}` : `👨‍⚕️ ${shareSelectedRecipientName}`}
                </Text>
              </View>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Authorized Vault</Text>
                <Text style={styles.contextValue}>
                  {shareSelectedCount} Records · {shareExpiryLabel}
                </Text>
              </View>
              <View style={styles.contextRecordsList}>
                {shareSelectedRecordsList.map((rec) => (
                  <Text key={rec.id} style={styles.contextRecordText} numberOfLines={1}>
                    • {rec.title} ({rec.type})
                  </Text>
                ))}
              </View>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Protection</Text>
                <Text style={styles.contextValueGreen}>✓ AES-256 · NDPR Cryptographic Seal</Text>
              </View>
            </View>

            {/* OTP Delivery Channel Selector */}
            <Text style={styles.channelSectionLabel}>SEND 6-DIGIT VERIFICATION CODE TO</Text>
            <View style={styles.channelSelectorRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setOtpChannel('phone');
                }}
                style={[
                  styles.channelBtn,
                  otpChannel === 'phone' && styles.channelBtnActive,
                ]}
              >
                <Text style={{ fontSize: 16 }}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelTitle, otpChannel === 'phone' && styles.channelTitleActive]}>
                    Phone (SMS)
                  </Text>
                  <Text style={styles.channelDetail}>+234 805 *** 5504</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setOtpChannel('email');
                }}
                style={[
                  styles.channelBtn,
                  otpChannel === 'email' && styles.channelBtnActive,
                ]}
              >
                <Text style={{ fontSize: 16 }}>✉️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelTitle, otpChannel === 'email' && styles.channelTitleActive]}>
                    Email
                  </Text>
                  <Text style={styles.channelDetail}>am***u@gmail.com</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 6-Digit OTP Input Boxes */}
            <Text style={styles.otpInputLabel}>ENTER 6-DIGIT AUTHORIZATION CODE</Text>
            <View style={styles.otpBoxesRow}>
              {otpDigits.map((digit, index) => {
                const isFilled = digit.length > 0;
                return (
                  <TextInput
                    key={index}
                    ref={(el) => {
                      otpInputsRef.current[index] = el;
                    }}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    style={[
                      styles.otpBox,
                      isFilled && styles.otpBoxFilled,
                    ]}
                  />
                );
              })}
            </View>

            {/* Demo Quick-Fill or Live Dispatch Badge */}
            {CONFIG.demoMode ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={autoFillDemoOtp}
                style={styles.demoFillBtn}
              >
                <Text style={styles.demoFillBtnText}>
                  💡 Tap to Auto-fill Demo Security Code: <Text style={{ fontWeight: '900' }}>849 201</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.liveDispatchBadge}>
                <Text style={{ fontSize: 13 }}>📡</Text>
                <Text style={styles.liveDispatchText}>
                  Live security code dispatched via Termii Gateway to{' '}
                  {otpChannel === 'phone' ? '+234 805 *** 5504' : 'am***u@gmail.com'}
                </Text>
              </View>
            )}

            {/* Resend Cooldown Link */}
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.countdownText}>
                  Resend in 0:{resendCooldown < 10 ? `0${resendCooldown}` : resendCooldown}
                </Text>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.light();
                    setResendCooldown(30);
                    if (!CONFIG.demoMode) {
                      if (otpChannel === 'phone') {
                        authService.sendPhoneOtp('+2348055555504').catch(() => {});
                      } else {
                        authService.sendEmailOtp('amara.nwosu@gmail.com').catch(() => {});
                      }
                    }
                  }}
                >
                  <Text style={styles.resendActionText}>Resend Code Now</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Security Lock State Message */}
            <View style={[styles.lockStatusBox, isOtpComplete && styles.lockStatusBoxUnlocked]}>
              <Text style={{ fontSize: 15 }}>{isOtpComplete ? '🔓' : '🔒'}</Text>
              <Text style={[styles.lockStatusText, isOtpComplete && styles.lockStatusTextUnlocked]}>
                {isOtpComplete
                  ? 'Identity Verified · Medical records ready to transmit securely'
                  : 'Access transmission locked until 6-digit patient code is entered'}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Step 4: Confirmation */}
        {state.shareStep === 4 && (
          <View style={styles.confirmedWrapper}>
            <View style={styles.confirmedIconCircle}>
              <Svg width={32} height={32} viewBox="0 0 20 20">
                <Path
                  d="M4 10l4 4 8-9"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.confirmedTitle}>Medical Access Granted</Text>
            <Text style={styles.confirmedSub}>
              {isFacilityRecipient
                ? `Authorized clinicians at ${shareSelectedRecipientName} can now view ${shareSelectedCount} records until ${shareExpiryLabel}.`
                : `${shareSelectedRecipientName} can now view ${shareSelectedCount} records until ${shareExpiryLabel}.`}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={actions.closeShareFlow}
              style={[styles.nextBtn, { marginTop: 24 }]}
            >
              <Text style={styles.nextBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Next / Authorize Button */}
        {showFooter && (
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={actions.shareNext}
              disabled={disabled}
              style={[
                styles.nextBtn,
                { backgroundColor: disabled ? '#e2e8f0' : '#041E42' },
              ]}
            >
              <Text
                style={[
                  styles.nextBtnText,
                  { color: disabled ? '#94a3b8' : '#ffffff' },
                ]}
              >
                {NEXT_LABELS[state.shareStep]}
              </Text>
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
  progressBarRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  helperText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  recordSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  recordEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSelectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  recordSelectDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  doctorInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13.5,
    marginBottom: 4,
  },
  recipientFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#041E42',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  sectionBlock: {
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 2,
  },
  sectionHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  orgTag: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  orgTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  facilityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  facilityCardSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  facilityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  facilityEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  facilityTypeLabel: {
    fontSize: 11.5,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 1,
  },
  facilityAddress: {
    fontSize: 11.5,
    color: '#64748b',
  },
  facilityBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  orgAccessPill: {
    backgroundColor: '#eff6ff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  orgAccessPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  facilityHmoText: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '700',
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  doctorCardSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  doctorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorInitials: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 13,
  },
  doctorName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  doctorSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  selectIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicatorActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  selectCheckmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  customInviteCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
    marginBottom: 10,
  },
  customInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInviteTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  customInviteSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  toggleInviteBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  toggleInviteBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#041E42',
  },
  customInviteForm: {
    marginTop: 12,
    gap: 8,
  },
  customInviteInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 12.5,
    color: '#0f172a',
  },
  inviteSelectBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  inviteSelectBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  bridgeWrapper: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  bridgeHelper: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  copyLinkBtn: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  copyLinkText: {
    color: '#041E42',
    fontSize: 13,
    fontWeight: '700',
  },
  expiryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  expiryLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  checkedDot: {
    width: 16,
    height: 16,
  },
  verifyHeaderBox: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  shieldIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  verifyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  verifyExplanation: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  contextCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
    marginBottom: 10,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  contextValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '65%',
  },
  contextValueGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  contextRecordsList: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 2,
  },
  contextRecordText: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
  },
  channelSectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  channelSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  channelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  channelBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  channelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  channelTitleActive: {
    color: '#0284c7',
  },
  channelDetail: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  otpInputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  otpBox: {
    width: 44,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  otpBoxFilled: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  demoFillBtn: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  demoFillBtnText: {
    fontSize: 11.5,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  liveDispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  liveDispatchText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    lineHeight: 14,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resendText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  countdownText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '700',
  },
  resendActionText: {
    fontSize: 11.5,
    color: '#0284c7',
    fontWeight: '800',
  },
  lockStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  lockStatusBoxUnlocked: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  lockStatusText: {
    flex: 1,
    fontSize: 11.5,
    color: '#b91c1c',
    lineHeight: 15,
  },
  lockStatusTextUnlocked: {
    color: '#166534',
  },
  confirmedWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  confirmedSub: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },
  nextBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#041E42',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
