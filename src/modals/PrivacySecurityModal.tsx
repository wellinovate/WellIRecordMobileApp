import React, { useMemo, useState } from "react";
import { authService } from "../services/authService";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { WelliApp } from "../state/useWelliApp";
import { LegalDocViewer } from "../components/LegalDocViewer";
import { LEGAL_DOCS } from "../data/legalDocs";

type PrivacyStep =
  | "security"
  | "help"
  | "privacy"
  | "delete";

function BackIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#172033"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6L15 12L9 18"
        stroke="#8EA5C0"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4L21 20H3L12 4Z"
        stroke="#A96726"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12 9V14"
        stroke="#A96726"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Header({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between">
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={onBack}
        className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"
      >
        <BackIcon />
      </TouchableOpacity>

      <Text className="text-[12px] font-semibold text-slate-800">
        WelliRecord<Text className="text-[7px]">™</Text>
      </Text>

      <View className="h-9 w-9" />
    </View>
  );
}

function InfoRow({
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  title: string;
  subtitle: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.76 : 1}
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center border-b border-slate-100 py-4"
    >
      <View className="flex-1 pr-3">
        <Text
          className={`text-[13px] font-semibold ${
            danger ? "text-red-700" : "text-[#173B68]"
          }`}
        >
          {title}
        </Text>

        <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
          {subtitle}
        </Text>
      </View>

      {onPress ? <ChevronIcon /> : null}
    </TouchableOpacity>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="text-[16px] font-extrabold text-[#082F67]">
        {title}
      </Text>

      <View className="mt-3 overflow-hidden rounded-2xl bg-[#EEF3FA] px-4">
        {children}
      </View>
    </View>
  );
}

export function PrivacySecurityModal({
  app,
}: {
  app: WelliApp;
}) {
  const { state, actions } = app;

  // The modal mounts fresh each time it opens. Password & sessions starts on "security";
  // Privacy Policy & Terms starts on "privacy". Each is its own page.
  const home: PrivacyStep = state.privacySecurityStart === "privacy" ? "privacy" : "security";
  const [step, setStep] =
    useState<PrivacyStep>(home);

  const [deletePassword, setDeletePassword] =
    useState("");

  const [
    deletionAcknowledged,
    setDeletionAcknowledged,
  ] = useState(false);

  const [readingTerms, setReadingTerms] = useState(false);
  const [pwStep, setPwStep] = useState<"idle" | "code">("idle");
  const [pwCode, setPwCode] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const currentSessionDate = useMemo(
    () =>
      new Date().toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      ),
    [],
  );

  if (!state.showPrivacySecurity) {
    return null;
  }

  const user = state.user as any;

  const deviceName =
    Platform.OS === "ios"
      ? "iPhone"
      : Platform.OS === "android"
        ? "Android device"
        : "Web browser";

  const email =
    user?.email || "Not added";

  const phone =
    user?.phoneNumber ||
    user?.phone ||
    "Not added";

  const close = () => {
    setStep(home);
    setDeletePassword("");
    setDeletionAcknowledged(false);
    actions.closePrivacySecurity();
  };

  const goBack = () => {
    if (step === home) {
      close();
      return;
    }
    // Deletion belongs to the privacy page; everything else returns to where the person started.
    setStep(step === "delete" ? "privacy" : home);
  };

  const openAssistant = () => {
    close();
    actions.setTab("chat");
  };

  const openSupportEmail = () => {
    Linking.openURL(
      "mailto:support@wellirecord.com",
    ).catch(() => {
      actions.showToast(
        "Unable to open your email app",
      );
    });
  };

  const verifyEmail = () => {
    actions.openContactVerify();
  };

  const verifyPhone = () => {
    actions.openContactVerify();
  };

  const managePassword = async () => {
    const target = String(email || "").trim();
    if (!target || !target.includes("@")) {
      actions.showToast("Add an email address to your profile first");
      return;
    }
    setPwBusy(true);
    try {
      await authService.requestPasswordReset(target);
      setPwStep("code");
      actions.showToast("We sent a code to your email");
    } catch (err: any) {
      actions.showToast(err?.message || "Could not send the code. Try again.");
    } finally {
      setPwBusy(false);
    }
  };

  const savePassword = async () => {
    if (pwCode.trim().length < 4 || pwNew.length < 8) {
      actions.showToast("Enter the code and a password of at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      await authService.resetPassword(String(email).trim(), pwCode, pwNew);
      setPwStep("idle");
      setPwCode("");
      setPwNew("");
      actions.showToast("Password updated");
    } catch (err: any) {
      actions.showToast(err?.message || "Could not update the password. Try again.");
    } finally {
      setPwBusy(false);
    }
  };

  const signOutOtherSessions = () => {
    Alert.alert(
      "Sign out other devices?",
      "Every other device will need to sign in again. This device stays signed in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out others",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.signOutOtherDevices();
              actions.showToast("Other devices signed out");
            } catch (err: any) {
              actions.showToast(err?.message || "Could not sign out other devices. Try again.");
            }
          },
        },
      ],
    );
  };

  const requestDeletion = () => {
    if (!deletePassword.trim()) {
      actions.showToast(
        "Enter your password to continue",
      );
      return;
    }

    if (!deletionAcknowledged) {
      actions.showToast(
        "Confirm that you understand your account will be deleted now",
      );
      return;
    }

    /*
     * Preserve the application's existing account-deletion route.
     * That action owns the final confirmation/destructive behavior.
     */
    actions.requestAccountDeletion();
  };

  return (
    <Modal
      visible={state.showPrivacySecurity}
      animationType="slide"
      transparent={false}
      onRequestClose={goBack}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* =====================================================
            ACCOUNT SECURITY
        ====================================================== */}
        {step === "security" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Header onBack={close} />

            <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
              Account and safety
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Account security
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Review verification, password and session controls.
            </Text>

            <SectionCard title="Verification">
              <InfoRow
                title="Email"
                subtitle={`${email || "No email on file"}`}
                onPress={verifyEmail}
              />

              <InfoRow
                title="Phone"
                subtitle={`${phone || "No phone on file"}`}
                onPress={verifyPhone}
              />

            </SectionCard>

            <SectionCard title="Password">
              <InfoRow
                title="Manage password"
                subtitle={pwBusy ? "Sending code…" : "Change it with a code sent to your email."}
                onPress={managePassword}
              />
              {pwStep === "code" ? (
                <View className="pb-4">
                  <TextInput
                    value={pwCode}
                    onChangeText={setPwCode}
                    placeholder="Code from your email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900"
                  />
                  <TextInput
                    value={pwNew}
                    onChangeText={setPwNew}
                    placeholder="New password (8+ characters)"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    autoComplete="new-password"
                    className="mt-2 min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900"
                  />
                  <TouchableOpacity
                    disabled={pwBusy}
                    onPress={savePassword}
                    className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-[#082F67]"
                  >
                    <Text className="text-[13px] font-semibold text-white">{pwBusy ? "Saving…" : "Save password"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard title="Additional security">
              <View className="border-b border-slate-100 py-4">
                <Text className="text-[13px] font-semibold text-[#173B68]">
                  App lock (always on)
                </Text>

                <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                  WelliRecord locks when you reopen it and after 5 minutes without a touch. You unlock it with your phone's biometrics or passcode, or with a code sent to your own email or phone. This cannot be turned off.
                </Text>
              </View>

              <InfoRow
                title="Authenticator app"
                subtitle="Ask for a 6-digit code from an authenticator app after your password or login code."
                onPress={actions.openTwoStep}
              />
              <InfoRow
                title="Security and access log"
                subtitle="See sign-ins, and every time someone other than you opened your record."
                onPress={actions.openAccountLog}
              />
            </SectionCard>

            <SectionCard title="This device">
              {state.deviceCompromised ? (
                <View className="border-b border-slate-100 py-4">
                  <Text className="text-[13px] font-bold text-red-700">This phone looks rooted or jailbroken</Text>
                  <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-600">
                    Other apps on it may be able to read your health records. Use WelliRecord on a phone you trust, and turn on the authenticator step.
                  </Text>
                </View>
              ) : null}
              <View className="py-4">
                <Text className="text-[13px] font-bold text-[#173B68]">
                  This {deviceName}
                </Text>

                <Text className="mt-1 text-[11px] leading-[16px] text-slate-500">
                  Current session · {currentSessionDate}
                </Text>

              </View>

              <TouchableOpacity
                activeOpacity={0.78}
                onPress={signOutOtherSessions}
                className="mb-4 min-h-[44px] items-center justify-center rounded-xl bg-[#E1E8F4]"
              >
                <Text className="text-[12px] font-semibold text-[#315B90]">
                  Sign out other devices
                </Text>
              </TouchableOpacity>
            </SectionCard>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setStep("help")}
              className="mt-5 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[12px] font-semibold text-[#315B90]">
                Help & support
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                void actions.logOut()
              }
              className="mt-5 min-h-[48px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Sign out
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Signing out other devices ends every session except this one.
            </Text>
          </ScrollView>
        ) : null}

        {/* =====================================================
            HELP & SUPPORT
        ====================================================== */}
        {step === "help" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Header onBack={goBack} />

            <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
              Account and safety
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              How can we help?
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Get guidance with app tasks, privacy and account access.
            </Text>

            <View className="mt-5 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4">
              <View className="flex-row items-start gap-3">
                <WarningIcon />

                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#A96726]">
                    Not emergency care
                  </Text>

                  <Text className="mt-2 text-[11.5px] leading-[17px] text-[#7C5B38]">
                    App support cannot provide emergency care. For urgent help,
                    contact local emergency services or a healthcare facility
                    directly.
                  </Text>
                </View>
              </View>
            </View>

            <SectionCard title="Common app tasks">
              <InfoRow
                title="Sign-in and recovery"
                subtitle="Email verification and password reset"
                onPress={() =>
                  actions.showToast(
                    "Sign-in and recovery help opened",
                  )
                }
              />

              <InfoRow
                title="Documents and OCR"
                subtitle="Upload, review text and understand sources"
                onPress={() => {
                  close();
                  actions.setTab("records");
                }}
              />

              <InfoRow
                title="Consent and Emergency ID"
                subtitle="Choose scope, review unknown allergy status"
                onPress={() =>
                  actions.showToast(
                    "Consent and Emergency ID help opened",
                  )
                }
              />
            </SectionCard>

            <SectionCard title="Contact support">
              <View className="py-4">
                <Text className="text-[13px] font-semibold text-[#173B68]">
                  Email support@wellirecord.com or ask the in-app assistant.
                </Text>

                <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                  Do not include passwords or unnecessary clinical details in
                  a message.
                </Text>
              </View>
            </SectionCard>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={openAssistant}
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Open app-task help
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() =>
                setStep("privacy")
              }
              className="mt-3 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Privacy and security help
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={openSupportEmail}
              className="mt-2 min-h-[44px] items-center justify-center"
            >
              <Text className="text-[12px] font-semibold text-slate-500">
                Email support
              </Text>
            </TouchableOpacity>

          </ScrollView>
        ) : null}

        {/* =====================================================
            PRIVACY & ACCOUNT
        ====================================================== */}
        {step === "privacy" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Header onBack={goBack} />

            <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
              Account and safety
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Privacy policy and terms
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              How WelliRecord handles your information, and your choices over it.
            </Text>

            <SectionCard title="Policy information">
              <InfoRow
                title="Privacy Policy"
                subtitle="Read how WelliRecord handles account and record data."
                onPress={
                  actions.openPrivacyPolicy
                }
              />

              <InfoRow
                title="Terms and Conditions"
                subtitle="Read the terms you agreed to when you created your account."
                onPress={() => setReadingTerms(true)}
              />

              <View className="py-3">
                <Text className="text-[10.5px] leading-[15px] text-slate-500">
                  Retention and deletion scope are subject to the published
                  policy. No fill-in compliance claim is made here.
                </Text>
              </View>
            </SectionCard>

            <SectionCard title="Your record, your choices">
              <InfoRow
                title="Consent"
                subtitle="Choose the recipient, record scope and access duration in WelliBridge."
              />

              <InfoRow
                title="Record sources"
                subtitle="Patient uploads and OCR are not verified facility lab entries."
              />

              <InfoRow
                title="Patient access"
                subtitle="Facilities and HMOs pay. Emergency ID is always free."
              />
            </SectionCard>

            <SectionCard title="Data portability">
              <InfoRow
                title="Export encrypted vault backup"
                subtitle="Keep a portable copy using the existing encrypted export flow."
                onPress={
                  actions.openVaultExport
                }
              />
            </SectionCard>

            <SectionCard title="Account controls">
              <InfoRow
                title="Deletion request"
                subtitle="A request, not instant deletion"
                onPress={() =>
                  setStep("delete")
                }
                danger
              />

              <View className="py-3">
                <Text className="text-[10.5px] leading-[15px] text-slate-500">
                  Provider clinical or legal records may be retained
                  separately. Account deletion does not guarantee their
                  removal.
                </Text>
              </View>
            </SectionCard>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() =>
                setStep("delete")
              }
              className="mt-5 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Delete account
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-[10.5px] leading-[15px] text-slate-400">
              Policy links are placeholders until final legal policy content is
              authored.
            </Text>
          </ScrollView>
        ) : null}

        {/* =====================================================
            ACCOUNT DELETION REQUEST
        ====================================================== */}
        {step === "delete" ? (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Header onBack={goBack} />

            <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
              Account and safety
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Delete account
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Read what is removed before you continue.
            </Text>

            <View className="mt-5 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4">
              <View className="flex-row items-start gap-3">
                <WarningIcon />

                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#A96726]">
                    Deletion is immediate and cannot be undone
                  </Text>

                  <Text className="mt-2 text-[11.5px] leading-[17px] text-[#7C5B38]">
                    Your account is erased from our servers as soon as you
                    confirm. We cannot restore it afterwards.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                What is removed
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Your account, the health records and documents you
                uploaded, prescriptions, family members, children's vaccines,
                growth and development entries, sharing links, and the access
                logs for your children. Save a copy of anything you need first.
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Records that a clinic or hospital holds in its own
                systems are not ours to delete and stay with them. Other
                guardians of a child you added keep no access to data you
                erased.
              </Text>
            </View>

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                Confirm your identity
              </Text>

              <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                Email: {email}
              </Text>

              <Text className="mt-4 text-[12px] font-semibold text-[#173B68]">
                Current password
              </Text>

              <TextInput
                value={deletePassword}
                onChangeText={
                  setDeletePassword
                }
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                autoComplete="current-password"
                textContentType="password"
                className="mt-2 min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900"
              />

              <Text className="mt-2 text-[10.5px] leading-[15px] text-slate-500">
                Deleting your account cannot be undone.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                setDeletionAcknowledged(
                  (current) => !current,
                )
              }
              className="mt-4 flex-row items-start gap-3 rounded-2xl bg-[#EEF3FA] p-4"
            >
              <View
                className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                  deletionAcknowledged
                    ? "border-[#315B90] bg-[#315B90]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {deletionAcknowledged ? (
                  <Text className="text-[11px] font-bold text-white">
                    ✓
                  </Text>
                ) : null}
              </View>

              <Text className="flex-1 text-[11.5px] leading-[17px] text-[#536A84]">
                I understand my account and data will be deleted now.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              disabled={
                !deletePassword.trim() ||
                !deletionAcknowledged
              }
              onPress={requestDeletion}
              className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${
                deletePassword.trim() &&
                deletionAcknowledged
                  ? "bg-[#082F67]"
                  : "bg-slate-200"
              }`}
            >
              <Text
                className={`text-[14px] font-semibold ${
                  deletePassword.trim() &&
                  deletionAcknowledged
                    ? "text-white"
                    : "text-slate-400"
                }`}
              >
                Delete my account
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() =>
                setStep("privacy")
              }
              className="mt-2 min-h-[44px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Cancel
              </Text>
            </TouchableOpacity>

          </ScrollView>
        ) : null}
      </SafeAreaView>
      <LegalDocViewer doc={readingTerms ? LEGAL_DOCS.terms : null} onClose={() => setReadingTerms(false)} />
    </Modal>
  );
}

export default PrivacySecurityModal;
