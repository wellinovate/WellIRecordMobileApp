import React, { useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { WelliApp } from "../state/useWelliApp";

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

  const [step, setStep] =
    useState<PrivacyStep>("security");

  const [deletePassword, setDeletePassword] =
    useState("");

  const [
    deletionAcknowledged,
    setDeletionAcknowledged,
  ] = useState(false);

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
    setStep("security");
    setDeletePassword("");
    setDeletionAcknowledged(false);
    actions.closePrivacySecurity();
  };

  const goBack = () => {
    if (step !== "security") {
      setStep("security");
      return;
    }

    close();
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
    actions.showToast(
      "Email verification management will be connected after the UI pass",
    );
  };

  const verifyPhone = () => {
    actions.showToast(
      "Phone verification management will be connected after the UI pass",
    );
  };

  const managePassword = () => {
    actions.showToast(
      "Password management will be connected after the UI pass",
    );
  };

  const signOutOtherSessions = () => {
    actions.showToast(
      "Other-session sign-out will be connected after the UI pass",
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
        "Confirm that you understand this submits a deletion request",
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
              Account and safety · design preview
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
                subtitle={`${email} · example not verified`}
                onPress={verifyEmail}
              />

              <InfoRow
                title="Phone"
                subtitle={`${phone} · example not verified`}
                onPress={verifyPhone}
              />

              <View className="py-3">
                <Text className="text-[10.5px] leading-[15px] text-slate-500">
                  Email/password is the mobile baseline. Phone login is
                  proposed, not enabled here.
                </Text>
              </View>
            </SectionCard>

            <SectionCard title="Password">
              <InfoRow
                title="Manage password"
                subtitle="Use recovery to choose a new password."
                onPress={managePassword}
              />
            </SectionCard>

            <SectionCard title="Additional security">
              <View className="flex-row items-center border-b border-slate-100 py-4">
                <View className="flex-1 pr-4">
                  <Text className="text-[13px] font-semibold text-[#173B68]">
                    Biometric lock
                  </Text>

                  <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                    Require device biometrics before opening protected areas.
                  </Text>
                </View>

                <Switch
                  value={state.faceIdEnabled}
                  onValueChange={() =>
                    actions.toggleFaceId()
                  }
                  trackColor={{
                    false: "#D9E0E9",
                    true: "#315B90",
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View className="flex-row items-center py-4">
                <View className="flex-1 pr-4">
                  <Text className="text-[13px] font-semibold text-[#173B68]">
                    Two-factor authentication
                  </Text>

                  <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                    Require an OTP during supported sign-in flows.
                  </Text>
                </View>

                <Switch
                  value={state.twoFactorEnabled}
                  onValueChange={() =>
                    actions.toggleTwoFactor()
                  }
                  trackColor={{
                    false: "#D9E0E9",
                    true: "#315B90",
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </SectionCard>

            <SectionCard title="Example current session">
              <View className="py-4">
                <Text className="text-[13px] font-bold text-[#173B68]">
                  This {deviceName}
                </Text>

                <Text className="mt-1 text-[11px] leading-[16px] text-slate-500">
                  Current session · {currentSessionDate}
                </Text>

                <Text className="mt-1 text-[11px] text-slate-500">
                  This is example session data, not a live list of actual
                  signed-in devices.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.78}
                onPress={signOutOtherSessions}
                className="mb-4 min-h-[44px] items-center justify-center rounded-xl bg-[#E1E8F4]"
              >
                <Text className="text-[12px] font-semibold text-[#315B90]">
                  Sign out other sessions
                </Text>
              </TouchableOpacity>
            </SectionCard>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  setStep("help")
                }
                className="flex-1 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
              >
                <Text className="text-[12px] font-semibold text-[#315B90]">
                  Help & support
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  setStep("privacy")
                }
                className="flex-1 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
              >
                <Text className="text-[12px] font-semibold text-[#315B90]">
                  Privacy & account
                </Text>
              </TouchableOpacity>
            </View>

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
              Only this device is listed. Other devices are not tracked yet.
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
              Account and safety · design preview
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
                  Use the published support channel when available in the
                  connected app.
                </Text>

                <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                  No real support email or phone number is connected in this
                  preview. Don't include passwords or unnecessary clinical
                  details.
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

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Design preview · no action is connected.
            </Text>
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
              Account and safety · design preview
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Privacy and your account
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Understand the boundaries of your record and sharing choices.
            </Text>

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

            <SectionCard title="Policy information">
              <InfoRow
                title="Privacy Policy"
                subtitle="Read how WelliRecord handles account and record data."
                onPress={
                  actions.openPrivacyPolicy
                }
              />

              <InfoRow
                title="Terms"
                subtitle="Terms placeholder for this UI pass."
                onPress={() =>
                  actions.showToast(
                    "Terms screen will be connected after the UI pass",
                  )
                }
              />

              <View className="py-3">
                <Text className="text-[10.5px] leading-[15px] text-slate-500">
                  Retention and deletion scope are subject to the published
                  policy. No fill-in compliance claim is made here.
                </Text>
              </View>
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
                title="Security and sessions"
                subtitle="Password, verification and sign-out controls"
                onPress={() =>
                  setStep("security")
                }
              />

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
                Request account deletion
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
              Account and safety · design preview
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Request account deletion
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Review what a request means before continuing.
            </Text>

            <View className="mt-5 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4">
              <View className="flex-row items-start gap-3">
                <WarningIcon />

                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#A96726]">
                    This is a request, not instant deletion
                  </Text>

                  <Text className="mt-2 text-[11.5px] leading-[17px] text-[#7C5B38]">
                    A connected service would confirm identity and review the
                    request under its published policy. No processing time is
                    promised.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                Consider before requesting
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Deletion may affect access to your account and
                patient-uploaded documents. Review-copy copies you need first.
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Retention and deletion scope follow the published policy. This
                does not guarantee deletion of provider clinical or legal
                records.
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
                Identity confirmation is not connected in this design preview.
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
                I understand this submits a deletion request.
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
                Request deletion
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

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Static preview · no request is submitted until the existing
              account action confirms it.
            </Text>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export default PrivacySecurityModal;
