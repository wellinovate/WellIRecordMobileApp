import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle, Path } from "react-native-svg";

import { formatDob } from "../utils/formatDate";
import { offlineSyncService } from "../services/offlineSyncService";
import { sharingService } from "../services/sharingService";
import { notificationService } from "../services/notificationService";
import { hapticFeedback } from "../utils/haptics";
import type { WelliApp } from "../state/useWelliApp";

type EmergencyStep = "setup" | "review" | "contact" | "allergy";

type QrState =
  | { status: "loading" }
  | { status: "ready"; url: string; offline: boolean }
  | { status: "unavailable" };

type ContactDraft = {
  name: string;
  relationship: string;
  phone: string;
};

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
      <Circle cx={12} cy={17} r={0.8} fill="#A96726" />
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

function PhoneIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92V20a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.19 18.93 19.5 19.5 0 0 1 5.19 12.93 19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3A2 2 0 0 1 9.1 3.72c.12.93.35 1.85.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.96.35 1.88.58 2.81.7A2 2 0 0 1 22 16.92Z"
        stroke="#315B90"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
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

function AllergyWarning({
  onPress,
  allergyText,
}: {
  onPress: () => void;
  allergyText: string;
}) {
  const notRecorded =
    !allergyText ||
    /^(none on file|not recorded|unknown|none reported)$/i.test(
      allergyText.trim(),
    );

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="mt-5 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4"
    >
      <View className="flex-row items-start gap-3">
        <WarningIcon />

        <View className="flex-1">
          <Text className="text-[13px] font-bold text-[#A96726]">
            Allergies: {notRecorded ? "Not recorded" : allergyText}
          </Text>

          <Text className="mt-2 text-[11.5px] leading-[17px] text-[#7C5B38]">
            Unknown status. Not recorded does not mean “No known allergies”.
            Confirm with the patient or care team.
          </Text>
        </View>

        <ChevronIcon />
      </View>
    </TouchableOpacity>
  );
}

function LabDetailsCard({
  bloodType,
  genotype,
}: {
  bloodType?: string;
  genotype?: string;
}) {
  return (
    <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
      <Text className="text-[14px] font-extrabold text-[#082F67]">
        Verified lab details
      </Text>

      <View className="mt-4 gap-4">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-[12px] font-semibold text-[#173B68]">
              Blood group
            </Text>
            <Text className="mt-1 text-[10.5px] leading-[15px] text-slate-500">
              No verified result available · read-only
            </Text>
          </View>

          <Text className="text-[14px] font-bold text-[#315B90]">
            {bloodType || "—"}
          </Text>
        </View>

        <View className="h-px bg-[#DCE5F0]" />

        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-[12px] font-semibold text-[#173B68]">
              Genotype
            </Text>
            <Text className="mt-1 text-[10.5px] leading-[15px] text-slate-500">
              No verified result available · read-only
            </Text>
          </View>

          <Text className="text-[14px] font-bold text-[#315B90]">
            {genotype || "—"}
          </Text>
        </View>
      </View>

      <Text className="mt-4 text-[10.5px] leading-[15px] text-slate-500">
        Only verified lab entries can populate these details.
      </Text>
    </View>
  );
}

function ContactCard({
  contact,
  onEdit,
  onCall,
}: {
  contact: ContactDraft;
  onEdit: () => void;
  onCall: () => void;
}) {
  const hasContact =
    Boolean(contact.name.trim()) ||
    Boolean(contact.phone.trim());

  return (
    <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
      <Text className="text-[14px] font-extrabold text-[#082F67]">
        Emergency contact
      </Text>

      <View className="mt-3 flex-row items-start gap-3">
        <PhoneIcon />

        <View className="flex-1">
          <Text className="text-[12px] font-semibold text-[#173B68]">
            {hasContact ? contact.name || "Named contact" : "Not added"}
          </Text>

          <Text className="mt-1 text-[10.5px] leading-[15px] text-slate-500">
            {hasContact
              ? [
                  contact.relationship,
                  contact.phone,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No name or contact number available"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onEdit}
        className="mt-4 min-h-[44px] items-center justify-center rounded-xl bg-[#E1E8F4]"
      >
        <Text className="text-[12px] font-semibold text-[#315B90]">
          {hasContact
            ? "Edit named contact"
            : "Add or edit named contact"}
        </Text>
      </TouchableOpacity>

      {hasContact && contact.phone ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onCall}
          className="mt-2 min-h-[44px] items-center justify-center rounded-xl border border-[#C9D7E8] bg-white"
        >
          <Text className="text-[12px] font-semibold text-[#315B90]">
            Call emergency contact
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmergencyModal({
  app,
}: {
  app: WelliApp;
}) {
  const { state, actions, family } = app;

  const emergencyMember =
    family.find(
      (member) =>
        member.id === state.activeFamilyId,
    ) ??
    family[0] ??
    null;

  const initialContact = useMemo<ContactDraft>(() => {
    const first =
      emergencyMember?.emergencyContacts?.[0];

    return {
      name: first?.name || "",
      relationship:
        first?.relationship || "",
      phone: first?.phone || "",
    };
  }, [
    emergencyMember?.id,
    emergencyMember?.emergencyContacts,
  ]);

  const [step, setStep] =
    useState<EmergencyStep>("setup");

  const [contactDraft, setContactDraft] =
    useState<ContactDraft>(initialContact);

  const [qr, setQr] = useState<QrState>({
    status: "loading",
  });

  const [isRevoking, setIsRevoking] =
    useState(false);

  const [isSimulating, setIsSimulating] =
    useState(false);

  const [feedbackMsg, setFeedbackMsg] =
    useState<string | null>(null);

  useEffect(() => {
    setContactDraft(initialContact);
  }, [initialContact]);

  useEffect(() => {
    if (!state.showEmergency) {
      setStep("setup");
    }
  }, [state.showEmergency]);

  useEffect(() => {
    if (
      !state.showEmergency ||
      !emergencyMember
    ) {
      return;
    }

    let cancelled = false;

    setQr({
      status: "loading",
    });

    void (async () => {
      if (offlineSyncService.isOnline()) {
        try {
          const link =
            await sharingService.createEmergencyShareLink(
              emergencyMember.id,
            );

          if (cancelled) {
            return;
          }

          setQr({
            status: "ready",
            url: link.shareUrl,
            offline: false,
          });

          await offlineSyncService.cacheEmergencyProfile(
            {
              id: emergencyMember.id,
              name: emergencyMember.name,
              wrId: emergencyMember.wrId,
              dob: emergencyMember.dob,
              bloodType:
                emergencyMember.bloodType,
              genotype:
                emergencyMember.genotype,
              allergies:
                emergencyMember.allergies,
              conditions:
                emergencyMember.conditions,
              contact:
                emergencyMember.contact,
              emergencyContacts:
                emergencyMember.emergencyContacts,
              hmoProvider: (
                emergencyMember as any
              ).hmoProvider,
              hmoPolicyNumber: (
                emergencyMember as any
              ).hmoPolicyNumber,
              qrPayload: link.shareUrl,
            },
          );

          return;
        } catch (error) {
          console.warn(
            "[EmergencyModal] Failed to create a fresh share link, falling back to cache:",
            error,
          );
        }
      }

      const cached =
        await offlineSyncService.getCachedEmergencyProfile();

      if (cancelled) {
        return;
      }

      if (
        cached &&
        cached.id === emergencyMember.id &&
        cached.qrPayload
      ) {
        setQr({
          status: "ready",
          url: cached.qrPayload,
          offline: true,
        });
      } else {
        setQr({
          status: "unavailable",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    state.showEmergency,
    emergencyMember?.id,
  ]);

  if (
    !state.showEmergency ||
    !emergencyMember
  ) {
    return null;
  }

  const isDependent =
    emergencyMember.role === "dependent";

  const guardianLine =
    isDependent && family[0]
      ? `Guardian: ${family[0].name}`
      : null;

  const allergyText =
    emergencyMember.allergies || "";

  const recordedAllergyStatus =
    allergyText &&
    !/^(none on file|not recorded|unknown|none reported)$/i.test(
      allergyText.trim(),
    )
      ? allergyText
      : "Not recorded";

  const close = () => {
    setStep("setup");
    actions.closeEmergency();
  };

  const goBack = () => {
    if (step === "review") {
      setStep("setup");
      return;
    }

    if (
      step === "contact" ||
      step === "allergy"
    ) {
      setStep("review");
      return;
    }

    close();
  };

  const openAssistant = () => {
    close();
    actions.setTab("chat");
  };

  const handleCallContact = () => {
    const source =
      contactDraft.phone ||
      emergencyMember.contact ||
      "";

    const phoneDigits = source.replace(
      /[^0-9+]/g,
      "",
    );

    if (!phoneDigits) {
      actions.showToast(
        "No emergency contact number is available",
      );
      return;
    }

    hapticFeedback.medium();

    Linking.openURL(
      `tel:${phoneDigits}`,
    ).catch(() => {
      actions.showToast(
        "Unable to open the phone dialer",
      );
    });
  };

  const handleSimulateScan = async () => {
    setIsSimulating(true);
    hapticFeedback.medium();

    try {
      await notificationService.triggerTestEmergencyAlert();

      setFeedbackMsg(
        "Scan alert sent. Look for the emergency alert banner.",
      );

      setTimeout(
        () => setFeedbackMsg(null),
        5000,
      );
    } catch {
      setFeedbackMsg(
        "Simulation failed",
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRevokeActive = async () => {
    if (
      qr.status !== "ready" ||
      !qr.url
    ) {
      return;
    }

    const token =
      qr.url.split("/").pop() || "";

    if (!token) {
      return;
    }

    setIsRevoking(true);
    hapticFeedback.warning();

    try {
      await notificationService.revokeEmergencyToken(
        token,
      );

      setFeedbackMsg(
        "QR code revoked. Generating a new secure link…",
      );

      setQr({
        status: "loading",
      });

      const newLink =
        await sharingService.createEmergencyShareLink(
          emergencyMember.id,
        );

      setQr({
        status: "ready",
        url: newLink.shareUrl,
        offline: false,
      });

      setFeedbackMsg(
        "New secure Emergency ID QR generated.",
      );

      setTimeout(
        () => setFeedbackMsg(null),
        4000,
      );
    } catch {
      setFeedbackMsg(
        "Failed to revoke the active QR code",
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const saveContactPreview = () => {
    hapticFeedback.success();

    actions.showToast(
      "Emergency contact saved in this UI preview",
    );

    setStep("review");
  };

  const confirmReview = () => {
    hapticFeedback.success();

    actions.showToast(
      "Emergency ID review confirmed",
    );
  };

  return (
    <Modal
      visible={state.showEmergency}
      animationType="slide"
      transparent={false}
      onRequestClose={goBack}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* =====================================================
            SETUP
        ====================================================== */}
        {step === "setup" ? (
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
              Emergency ID · 1 of 2
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Set up Emergency ID
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Review essential information. Emergency ID is always free to
              access.
            </Text>

            <AllergyWarning
              allergyText={allergyText}
              onPress={() =>
                setStep("allergy")
              }
            />

            <ContactCard
              contact={contactDraft}
              onEdit={() =>
                setStep("contact")
              }
              onCall={handleCallContact}
            />

            <LabDetailsCard
              bloodType={
                emergencyMember.bloodType
              }
              genotype={
                emergencyMember.genotype
              }
            />

            <Text className="mt-4 text-[10.5px] leading-[15px] text-slate-500">
              Blood group and genotype cannot be entered here. Ask your care
              team about verified lab entries.
            </Text>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() =>
                setStep("review")
              }
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Preview Emergency ID
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={openAssistant}
              className="mt-3 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Set up with Assistant
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Design preview · no action is connected.
            </Text>
          </ScrollView>
        ) : null}

        {/* =====================================================
            REVIEW
        ====================================================== */}
        {step === "review" ? (
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
              Emergency ID · 2 of 2
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Review Emergency ID
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Always free. Check the source and unknown status before relying on
              this information.
            </Text>

            <AllergyWarning
              allergyText={allergyText}
              onPress={() =>
                setStep("allergy")
              }
            />

            <View className="mt-4 rounded-2xl bg-[#082F67] p-4">
              <Text className="text-[11px] font-semibold text-[#BFD0E5]">
                WelliRecord Emergency ID
              </Text>

              <Text className="mt-4 text-[20px] font-extrabold text-white">
                {emergencyMember.name}
              </Text>

              {emergencyMember.wrId ? (
                <Text className="mt-1 text-[11.5px] font-semibold text-[#BFD0E5]">
                  WelliID · {emergencyMember.wrId}
                </Text>
              ) : null}

              <Text className="mt-1 text-[11px] text-[#A8BCD5]">
                DOB: {formatDob(emergencyMember.dob)}
              </Text>

              {guardianLine ? (
                <Text className="mt-1 text-[11px] font-semibold text-[#F4D49E]">
                  {guardianLine}
                </Text>
              ) : null}
            </View>

            <LabDetailsCard
              bloodType={
                emergencyMember.bloodType
              }
              genotype={
                emergencyMember.genotype
              }
            />

            <ContactCard
              contact={contactDraft}
              onEdit={() =>
                setStep("contact")
              }
              onCall={handleCallContact}
            />

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                Secure Emergency QR
              </Text>

              <View className="mt-4 items-center">
                {qr.status === "ready" ? (
                  <>
                    <View className="rounded-xl bg-white p-3">
                      <QRCode
                        value={qr.url}
                        size={112}
                        color="#0F172A"
                        backgroundColor="#FFFFFF"
                      />
                    </View>

                    <Text className="mt-3 text-center text-[10.5px] leading-[15px] text-slate-500">
                      {qr.offline
                        ? "Showing the last secure link generated while online."
                        : "First responders can scan this time-limited Emergency ID link."}
                    </Text>
                  </>
                ) : qr.status ===
                  "loading" ? (
                  <>
                    <ActivityIndicator
                      color="#082F67"
                    />

                    <Text className="mt-3 text-[10.5px] text-slate-500">
                      Generating secure share link…
                    </Text>
                  </>
                ) : (
                  <Text className="text-center text-[10.5px] leading-[15px] text-slate-500">
                    Secure QR is unavailable. Reconnect to the internet and
                    reopen Emergency ID.
                  </Text>
                )}
              </View>
            </View>

            {/* Existing security behavior is preserved here. */}
            <View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#F8FAFD] p-4">
              <Text className="text-[13px] font-bold text-[#173B68]">
                Emergency QR security
              </Text>

              <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                Emergency QR scans can trigger a security alert. You can also
                revoke an active online QR and generate a fresh secure link.
              </Text>

              {feedbackMsg ? (
                <View className="mt-3 rounded-xl bg-[#E7F3FB] p-3">
                  <Text className="text-center text-[11px] font-semibold text-[#315B90]">
                    {feedbackMsg}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={
                  handleSimulateScan
                }
                disabled={isSimulating}
                className="mt-4 min-h-[44px] items-center justify-center rounded-xl bg-[#EEF3FA]"
              >
                {isSimulating ? (
                  <ActivityIndicator
                    size="small"
                    color="#315B90"
                  />
                ) : (
                  <Text className="text-[12px] font-semibold text-[#315B90]">
                    Test first responder alert
                  </Text>
                )}
              </TouchableOpacity>

              {qr.status === "ready" &&
              !qr.offline ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={
                    handleRevokeActive
                  }
                  disabled={isRevoking}
                  className="mt-2 min-h-[44px] items-center justify-center rounded-xl border border-red-200 bg-red-50"
                >
                  {isRevoking ? (
                    <ActivityIndicator
                      size="small"
                      color="#B42318"
                    />
                  ) : (
                    <Text className="text-[12px] font-semibold text-red-700">
                      Revoke active QR
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            <Text className="mt-4 text-[10.5px] leading-[15px] text-slate-500">
              Status is unchanged from setup. This design contains no clinical
              edits until those actions are connected.
            </Text>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={confirmReview}
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Confirm review
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={openAssistant}
              className="mt-3 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Update with Assistant
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Status is unchanged from setup.
            </Text>
          </ScrollView>
        ) : null}

        {/* =====================================================
            EMERGENCY CONTACT EDIT
        ====================================================== */}
        {step === "contact" ? (
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
              Add an emergency contact
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Choose someone you trust and confirm their details with them.
            </Text>

            <View className="mt-6">
              <Text className="text-[12px] font-semibold text-[#173B68]">
                Contact name
              </Text>

              <TextInput
                value={contactDraft.name}
                onChangeText={(name) =>
                  setContactDraft(
                    (current) => ({
                      ...current,
                      name,
                    }),
                  )
                }
                placeholder="Enter full name"
                placeholderTextColor="#94A3B8"
                className="mt-2 min-h-[46px] rounded-xl border border-slate-200 px-3 text-[14px] text-slate-900"
              />
            </View>

            <View className="mt-5">
              <Text className="text-[12px] font-semibold text-[#173B68]">
                Relationship
              </Text>

              <TextInput
                value={
                  contactDraft.relationship
                }
                onChangeText={(
                  relationship,
                ) =>
                  setContactDraft(
                    (current) => ({
                      ...current,
                      relationship,
                    }),
                  )
                }
                placeholder="Choose relationship"
                placeholderTextColor="#94A3B8"
                className="mt-2 min-h-[46px] rounded-xl border border-slate-200 px-3 text-[14px] text-slate-900"
              />
            </View>

            <View className="mt-5">
              <Text className="text-[12px] font-semibold text-[#173B68]">
                Phone number
              </Text>

              <TextInput
                value={
                  contactDraft.phone
                }
                onChangeText={(phone) =>
                  setContactDraft(
                    (current) => ({
                      ...current,
                      phone,
                    }),
                  )
                }
                keyboardType="phone-pad"
                placeholder="Enter number with country code"
                placeholderTextColor="#94A3B8"
                className="mt-2 min-h-[46px] rounded-xl border border-slate-200 px-3 text-[14px] text-slate-900"
              />

              <Text className="mt-2 text-[10.5px] leading-[15px] text-slate-500">
                Confirm this number with your contact.
              </Text>
            </View>

            <View className="mt-5 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[13px] font-bold text-[#173B68]">
                Review before saving
              </Text>

              <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">
                Include a name, relationship and phone number. Emergency ID
                continues to show “Not added” until a contact is saved in a
                connected service.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              disabled={
                !contactDraft.name.trim() ||
                !contactDraft.phone.trim()
              }
              onPress={saveContactPreview}
              className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${
                contactDraft.name.trim() &&
                contactDraft.phone.trim()
                  ? "bg-[#082F67]"
                  : "bg-slate-200"
              }`}
            >
              <Text
                className={`text-[14px] font-semibold ${
                  contactDraft.name.trim() &&
                  contactDraft.phone.trim()
                    ? "text-white"
                    : "text-slate-400"
                }`}
              >
                Save contact
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={goBack}
              className="mt-2 min-h-[44px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Cancel
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Empty form · no contact has been added or saved.
            </Text>
          </ScrollView>
        ) : null}

        {/* =====================================================
            ALLERGY REVIEW
        ====================================================== */}
        {step === "allergy" ? (
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
              Review allergy status
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Make allergy information a priority before your next care visit.
            </Text>

            <AllergyWarning
              allergyText={allergyText}
              onPress={() => {}}
            />

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                Current record
              </Text>

              <View className="mt-4">
                <Text className="text-[12px] font-semibold text-[#173B68]">
                  Recorded allergy status
                </Text>

                <Text className="mt-1 text-[11px] leading-[16px] text-slate-500">
                  {recordedAllergyStatus} · source unavailable
                </Text>
              </View>

              <View className="my-4 h-px bg-[#DCE5F0]" />

              <View>
                <Text className="text-[12px] font-semibold text-[#173B68]">
                  Patient-reported information
                </Text>

                <Text className="mt-1 text-[11px] leading-[16px] text-slate-500">
                  No entry shown · not care-team verified
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[14px] font-extrabold text-[#082F67]">
                What to do next
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Ask your care team to record or confirm your allergy status.
                Tell them about any known allergies or reactions.
              </Text>

              <Text className="mt-3 text-[11.5px] leading-[17px] text-[#536A84]">
                Patient-reported information and care-team-confirmed records
                must stay distinct. This screen does not diagnose or recommend
                treatment.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={openAssistant}
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Ask Assistant for app help
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() =>
                setStep("review")
              }
              className="mt-3 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Back to Emergency ID
              </Text>
            </TouchableOpacity>

            <Text className="mt-3 text-center text-[10.5px] text-slate-400">
              Design preview · no action is connected.
            </Text>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export default EmergencyModal;
