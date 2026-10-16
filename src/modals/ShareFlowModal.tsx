import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

import type { WelliApp } from "../state/useWelliApp";

type FlowStep = "recipient" | "scope" | "review" | "preview";
type AccessDuration = "15m" | "1h" | "24h";
type ShareMethod = "qr" | "confirmed";

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

function QrPlaceholder() {
  return (
    <View className="h-[112px] w-[112px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
      <Svg width={76} height={76} viewBox="0 0 76 76" fill="none">
        <Rect
          x="2"
          y="2"
          width="22"
          height="22"
          rx="2"
          stroke="#315B90"
          strokeWidth="3"
        />
        <Rect
          x="52"
          y="2"
          width="22"
          height="22"
          rx="2"
          stroke="#315B90"
          strokeWidth="3"
        />
        <Rect
          x="2"
          y="52"
          width="22"
          height="22"
          rx="2"
          stroke="#315B90"
          strokeWidth="3"
        />
        <Path
          d="M31 4H40V13H31V4ZM31 18H46V27H31V18ZM52 31H74V40H52V31ZM31 34H40V49H31V34ZM45 45H56V56H45V45ZM60 47H74V61H60V47ZM31 60H44V74H31V60ZM51 64H58V74H51V64Z"
          fill="#315B90"
        />
      </Svg>
    </View>
  );
}

function OptionCard({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      className={`rounded-2xl border p-4 ${
        selected
          ? "border-[#315B90] bg-[#EEF3FA]"
          : "border-slate-200 bg-white"
      }`}
    >
      <View className="flex-row items-start">
        <View className="flex-1 pr-4">
          <Text className="text-[14px] font-bold text-[#173B68]">
            {title}
          </Text>

          <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
            {subtitle}
          </Text>
        </View>

        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${
            selected
              ? "border-[#315B90] bg-[#315B90]"
              : "border-slate-300 bg-white"
          }`}
        >
          {selected ? (
            <Text className="text-[11px] font-bold text-white">✓</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ShareFlowModal({ app }: { app: WelliApp }) {
  const { state, actions, records, facilities, doctors } = app;

  const [step, setStep] = useState<FlowStep>("recipient");

  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");

  const [shareMethod, setShareMethod] = useState<ShareMethod>("qr");

  const [shareDocuments, setShareDocuments] = useState(true);
  const [shareEmergencyId, setShareEmergencyId] = useState(false);

  const [duration, setDuration] = useState<AccessDuration>("1h");

  const ownedRecords = records.filter(
    (record) => record.ownerId === state.activeFamilyId,
  );

  const recipientOptions = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
    }> = [];

    facilities.slice(0, 2).forEach((facility) => {
      items.push({
        id: facility.id,
        title: facility.name,
        subtitle: `${
          (facility as any).typeLabel || facility.type || "Clinic"
        } · ${facility.specialty || "Care team"}`,
      });
    });

    doctors.slice(0, 1).forEach((doctor: any) => {
      items.push({
        id: doctor.id,
        title: doctor.name,
        subtitle: `${doctor.specialty || "Clinician"} · ${
          doctor.org || "Care team"
        }`,
      });
    });

    if (!items.length) {
      items.push(
        {
          id: "demo-community-clinic",
          title: "Demo Community Clinic",
          subtitle: "Primary care · visit team",
        },
        {
          id: "patient-care-team",
          title: "Patient's care team",
          subtitle: "Family or trusted care team",
        },
      );
    }

    return items;
  }, [facilities, doctors]);

  if (!state.showShareFlow) {
    return null;
  }

  const durationLabel =
    duration === "15m"
      ? "15 minutes"
      : duration === "1h"
        ? "1 hour"
        : "24 hours";

  const sharingMethodLabel =
    shareMethod === "qr"
      ? "Secure QR code or link"
      : "Confirmed intended recipient";

  const selectedScope = [
    shareDocuments
      ? `${ownedRecords.length} patient-uploaded ${
          ownedRecords.length === 1 ? "document" : "documents"
        }`
      : null,
    shareEmergencyId ? "Emergency Medical ID" : null,
  ].filter(Boolean) as string[];

  const canContinueFromScope =
    shareDocuments || shareEmergencyId;

  const resetLocalFlow = () => {
    setStep("recipient");
    setRecipientId(null);
    setRecipientName("");
    setShareMethod("qr");
    setShareDocuments(true);
    setShareEmergencyId(false);
    setDuration("1h");
  };

  const close = () => {
    resetLocalFlow();
    actions.closeShareFlow();
  };

  const goBack = () => {
    if (step === "preview") {
      setStep("review");
      return;
    }

    if (step === "review") {
      setStep("scope");
      return;
    }

    if (step === "scope") {
      setStep("recipient");
      return;
    }

    close();
  };

  const chooseRecipient = (id: string, name: string) => {
    setRecipientId(id);
    setRecipientName(name);

    try {
      actions.selectDoctor(id);
    } catch {
      // UI-first pass: local recipient state remains authoritative
      // for the visual flow until backend wiring is restored.
    }
  };

  const copyPreviewLink = () => {
    actions.showToast("Demo share link copied");
  };

  return (
    <Modal
      visible={state.showShareFlow}
      animationType="slide"
      transparent={false}
      onRequestClose={goBack}
    >
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="min-h-[44px] flex-row items-center justify-between">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={goBack}
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"
            >
              <BackIcon />
            </TouchableOpacity>

            <Text className="text-[12px] font-semibold text-slate-800">
              WelliRecord<Text className="text-[7px]">™</Text>
            </Text>

            <View className="h-9 w-9" />
          </View>

          <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
            WelliBridge · Safe share
          </Text>

          {/* =====================================================
              STEP 1 — RECIPIENT
          ====================================================== */}
          {step === "recipient" ? (
            <>
              <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
                Who are you sharing with?
              </Text>

              <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
                Select the intended recipient before choosing what they can
                access.
              </Text>

              <View className="mt-6 gap-3">
                {recipientOptions.map((recipient) => (
                  <OptionCard
                    key={recipient.id}
                    title={recipient.title}
                    subtitle={recipient.subtitle}
                    selected={recipientId === recipient.id}
                    onPress={() =>
                      chooseRecipient(
                        recipient.id,
                        recipient.title,
                      )
                    }
                  />
                ))}
              </View>

              <View className="mt-6">
                <Text className="text-[16px] font-extrabold text-[#082F67]">
                  Sharing method
                </Text>

                <View className="mt-3 gap-3">
                  <OptionCard
                    title="QR code or link"
                    subtitle="Create a time-limited WelliBridge link for this recipient."
                    selected={shareMethod === "qr"}
                    onPress={() => setShareMethod("qr")}
                  />

                  <OptionCard
                    title="Confirm the intended recipient"
                    subtitle="Use this when the person or clinic is with you."
                    selected={shareMethod === "confirmed"}
                    onPress={() =>
                      setShareMethod("confirmed")
                    }
                  />
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!recipientId}
                onPress={() => setStep("scope")}
                className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${
                  recipientId
                    ? "bg-[#082F67]"
                    : "bg-slate-200"
                }`}
              >
                <Text
                  className={`text-[14px] font-semibold ${
                    recipientId
                      ? "text-white"
                      : "text-slate-400"
                  }`}
                >
                  Choose records
                </Text>
              </TouchableOpacity>

              {/* Preserved from previous version */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={close}
                className="mt-2 min-h-[44px] items-center justify-center"
              >
                <Text className="text-[13px] font-semibold text-slate-500">
                  Cancel share
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* =====================================================
              STEP 2 — SCOPE
          ====================================================== */}
          {step === "scope" ? (
            <>
              <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
                Choose what to share
              </Text>

              <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
                {recipientName || "Selected recipient"} · choose only what is
                needed.
              </Text>

              <View className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">
                <View className="flex-row items-center">
                  <View className="flex-1 pr-4">
                    <Text className="text-[14px] font-bold text-[#173B68]">
                      Patient-uploaded documents
                    </Text>

                    <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                      {ownedRecords.length} available in your record.
                    </Text>
                  </View>

                  <Switch
                    value={shareDocuments}
                    onValueChange={setShareDocuments}
                    trackColor={{
                      false: "#D9E0E9",
                      true: "#315B90",
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center">
                  <View className="flex-1 pr-4">
                    <Text className="text-[14px] font-bold text-[#173B68]">
                      Emergency ID
                    </Text>

                    <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                      Emergency-safe identity and allergy details.
                    </Text>
                  </View>

                  <Switch
                    value={shareEmergencyId}
                    onValueChange={setShareEmergencyId}
                    trackColor={{
                      false: "#D9E0E9",
                      true: "#315B90",
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Preserved from previous version */}
              <View className="mt-3 rounded-2xl bg-[#EEF3FA] p-4">
                <Text className="text-[13px] font-bold text-[#173B68]">
                  Facility labs are not on mobile
                </Text>

                <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">
                  This mobile consent flow only includes the categories shown
                  here.
                </Text>
              </View>

              <View className="mt-6">
                <Text className="text-[16px] font-extrabold text-[#082F67]">
                  Access duration
                </Text>

                <View className="mt-3 flex-row rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {[
                    ["15m", "15 mins"],
                    ["1h", "1 hour"],
                    ["24h", "24 hours"],
                  ].map(([value, label]) => {
                    const active =
                      duration === value;

                    return (
                      <TouchableOpacity
                        key={value}
                        activeOpacity={0.8}
                        onPress={() =>
                          setDuration(
                            value as AccessDuration,
                          )
                        }
                        className={`flex-1 items-center rounded-lg py-3 ${
                          active
                            ? "bg-[#082F67]"
                            : ""
                        }`}
                      >
                        <Text
                          className={`text-[12px] font-semibold ${
                            active
                              ? "text-white"
                              : "text-[#315B90]"
                          }`}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text className="mt-2 text-[10.5px] leading-[15px] text-slate-500">
                  Temporary access automatically expires.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!canContinueFromScope}
                onPress={() => setStep("review")}
                className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${
                  canContinueFromScope
                    ? "bg-[#082F67]"
                    : "bg-slate-200"
                }`}
              >
                <Text
                  className={`text-[14px] font-semibold ${
                    canContinueFromScope
                      ? "text-white"
                      : "text-slate-400"
                  }`}
                >
                  Review consent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setStep("recipient")}
                className="mt-2 min-h-[44px] items-center justify-center"
              >
                <Text className="text-[13px] font-semibold text-slate-500">
                  Back to recipient
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* =====================================================
              STEP 3 — REVIEW
          ====================================================== */}
          {step === "review" ? (
            <>
              <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
                Review your consent
              </Text>

              <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
                Only the scope below will be included in this share.
              </Text>

              <View className="mt-6 rounded-2xl bg-[#EEF3FA] p-4">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">
                  Sharing summary
                </Text>

                <View className="mt-4 gap-4">
                  <View>
                    <Text className="text-[11px] text-slate-500">
                      Recipient
                    </Text>

                    <Text className="mt-1 text-[14px] font-bold text-[#173B68]">
                      {recipientName}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-[11px] text-slate-500">
                      Selected scope
                    </Text>

                    <Text className="mt-1 text-[13px] leading-[19px] font-semibold text-[#173B68]">
                      {selectedScope.join(" · ")}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-[11px] text-slate-500">
                      Duration
                    </Text>

                    <Text className="mt-1 text-[14px] font-bold text-[#173B68]">
                      {durationLabel}
                    </Text>
                  </View>

                  {/* Preserved from previous version */}
                  <View>
                    <Text className="text-[11px] text-slate-500">
                      Sharing method
                    </Text>

                    <Text className="mt-1 text-[13px] font-semibold text-[#173B68]">
                      {sharingMethodLabel}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-[11px] text-slate-500">
                      Not included
                    </Text>

                    <Text className="mt-1 text-[13px] leading-[19px] font-semibold text-[#173B68]">
                      Facility lab results, billing and payment information
                    </Text>
                  </View>
                </View>
              </View>

              {!shareEmergencyId ? (
                <View className="mt-4 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4">
                  <Text className="text-[13px] font-bold text-[#A96726]">
                    Allergy information is not included
                  </Text>

                  <Text className="mt-2 text-[11.5px] leading-[17px] text-[#7C5B38]">
                    Turn on Emergency ID if this recipient needs emergency-safe
                    allergy information.
                  </Text>
                </View>
              ) : null}

              {/* Preserved from previous version */}
              <View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#F3F6FB] p-4">
                <Text className="text-[13px] font-bold text-[#173B68]">
                  I confirm this recipient, document scope and access duration
                </Text>

                <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">
                  Backend authorization and secure-link creation will be wired
                  after the UI pass.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setStep("preview")}
                className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
              >
                <Text className="text-[14px] font-semibold text-white">
                  Create sharing link
                </Text>
              </TouchableOpacity>

              {/* Preserved from previous version */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setStep("scope")}
                className="mt-2 min-h-[44px] items-center justify-center"
              >
                <Text className="text-[13px] font-semibold text-[#315B90]">
                  Edit scope
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* =====================================================
              STEP 4 — SHARING LINK PREVIEW
          ====================================================== */}
          {step === "preview" ? (
            <>
              <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
                Sharing link preview
              </Text>

              <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
                This demo link shows what the recipient would receive.
              </Text>

              <View className="mt-6 items-center rounded-2xl border border-slate-200 bg-[#F8FAFD] p-5">
                <QrPlaceholder />

                <Text className="mt-4 text-[13px] font-semibold text-[#315B90]">
                  wellibridge.demo/share/preview
                </Text>
              </View>

              <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">
                  Selected sharing scope
                </Text>

                <Text className="mt-3 text-[14px] font-bold text-[#173B68]">
                  {recipientName}
                </Text>

                <Text className="mt-2 text-[12px] leading-[18px] text-[#536A84]">
                  {selectedScope.join(" · ")}
                </Text>

                <Text className="mt-3 text-[12px] font-semibold text-[#173B68]">
                  {sharingMethodLabel}
                </Text>

                <Text className="mt-2 text-[12px] font-semibold text-[#173B68]">
                  Expires in {durationLabel}
                </Text>
              </View>

              <View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#F3F6FB] p-4">
                <Text className="text-[13px] font-bold text-[#173B68]">
                  Private link expires automatically
                </Text>

                <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">
                  The production share service will create the real token-gated
                  link after the functionality pass.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={copyPreviewLink}
                className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
              >
                <Text className="text-[14px] font-semibold text-white">
                  Copy share link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setStep("review")}
                className="mt-2 min-h-[44px] items-center justify-center"
              >
                <Text className="text-[13px] font-semibold text-[#315B90]">
                  Back to consent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={close}
                className="min-h-[44px] items-center justify-center"
              >
                <Text className="text-[13px] font-semibold text-slate-500">
                  Close
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default ShareFlowModal;
