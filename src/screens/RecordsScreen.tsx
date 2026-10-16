import { useMemo, useState } from "react";
import {
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { LogoMark } from "../components/Logo";
import { RECORD_META } from "../data/mockData";
import { OfflineSyncBanner } from "../components/OfflineSyncBanner";
import { EmergencyScanAlertBanner } from "../components/EmergencyScanAlertBanner";
import type { WelliApp } from "../state/useWelliApp";

type RecordSection = "uploads" | "medical";

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
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
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
      <Circle cx={12} cy={17} r={0.8} fill="#A96726" />
    </Svg>
  );
}

function DetailRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.76}
      onPress={onPress}
      className="flex-row items-center border-b border-slate-100 py-4"
    >
      <View className="flex-1 pr-3">
        <Text className="text-[14px] font-semibold text-[#173B68]">
          {title}
        </Text>
        <Text className="mt-1 text-[12px] leading-[17px] text-slate-500">
          {subtitle}
        </Text>
      </View>
      <ChevronIcon />
    </TouchableOpacity>
  );
}

export function RecordsScreen({ app }: { app: WelliApp }) {
  const { state, actions, records, family, prescriptions } = app;
  const memberPrescriptions = prescriptions.filter((rx) => rx.ownerId === state.activeFamilyId);
  const [section, setSection] = useState<RecordSection>("uploads");

  const activeMember =
    family.find((member) => member.id === state.activeFamilyId) ??
    family[0] ??
    ({ id: "me", name: "WelliRecord Patient" } as any);

  const memberRecords = records.filter(
    (record) => record.ownerId === state.activeFamilyId,
  );
  const ownedRecords = memberRecords.filter(
    (record) => record.source !== "facility",
  );
  const facilityRecords = memberRecords.filter(
    (record) => record.source === "facility",
  );

  const medical = activeMember as any;

  const allergyText = useMemo(() => {
    const raw = medical?.allergies;

    if (Array.isArray(raw)) {
      return raw.filter(Boolean).join(", ");
    }

    return typeof raw === "string" ? raw.trim() : "";
  }, [medical?.allergies]);

  const hasAllergies =
    Boolean(allergyText) &&
    !/^(none|none on file|not recorded|unknown)$/i.test(allergyText);

  const displayValue = (value: unknown, fallback = "Not provided") => {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : fallback;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    return fallback;
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <OfflineSyncBanner />
        <EmergencyScanAlertBanner app={app} />

        <View className="mb-4">
          <View className="min-h-[44px] flex-row items-center justify-between">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={
                state.tabHistory.length > 0
                  ? actions.goBackTab
                  : () => actions.setTab("home")
              }
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"
            >
              <BackIcon />
            </TouchableOpacity>

            <Text className="text-[12px] font-semibold text-slate-800">
              WelliRecord<Text className="text-[7px]">™</Text>
            </Text>

            <View className="h-9 w-9" />
          </View>

          <View className="mt-2 flex-row items-center gap-2">
            <LogoMark
              size={20}
              shieldColor="#082F67"
              markColor="#FFFFFF"
              strokeColor="#082F67"
            />
            <Text className="text-[11px] font-semibold text-[#315B90]">
              My health record
            </Text>
          </View>

          <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
            {section === "medical" ? "Medical details" : "My health record"}
          </Text>

          <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
            {section === "medical"
              ? "Safety information for urgent care."
              : "Bring your documents with you. Keep their source clear."}
          </Text>
        </View>

        <View className="mb-5 flex-row rounded-xl border border-slate-200 bg-slate-50 p-1">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSection("uploads")}
            className={`flex-1 items-center rounded-lg py-3 ${
              section === "uploads" ? "bg-[#082F67]" : ""
            }`}
          >
            <Text
              className={`text-[12px] font-semibold ${
                section === "uploads" ? "text-white" : "text-[#173B68]"
              }`}
            >
              My uploads
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSection("medical")}
            className={`flex-1 items-center rounded-lg py-3 ${
              section === "medical" ? "bg-[#082F67]" : ""
            }`}
          >
            <Text
              className={`text-[12px] font-semibold ${
                section === "medical" ? "text-white" : "text-[#173B68]"
              }`}
            >
              Medical details
            </Text>
          </TouchableOpacity>
        </View>

        {section === "medical" ? (
          <>
            <View className="mb-5 rounded-2xl border border-[#F0CAA0] bg-[#FFF4E7] p-4">
              <View className="flex-row items-start gap-3">
                <WarningIcon />

                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-[#A96726]">
                    Allergies
                  </Text>

                  <Text className="mt-2 text-[13px] leading-[19px] text-[#6E543A]">
                    {hasAllergies
                      ? allergyText
                      : "Not recorded"}
                  </Text>

                  <Text className="mt-2 text-[11.5px] leading-[16px] text-[#8A6C4A]">
                    We won't share allergy details as final clinical truth.
                    Please confirm them with your care team.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[18px] font-extrabold text-[#082F67]">
                Blood group and genotype
              </Text>

              <View className="mt-3 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-[#EEF3FA] p-4">
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">
                    Blood group
                  </Text>
                  <Text className="mt-2 text-[18px] font-extrabold text-[#173B68]">
                    {displayValue(medical?.bloodType, "Unknown")}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-500">
                    You should verify this.
                  </Text>
                </View>

                <View className="flex-1 rounded-2xl bg-[#EEF3FA] p-4">
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">
                    Genotype
                  </Text>
                  <Text className="mt-2 text-[18px] font-extrabold text-[#173B68]">
                    {displayValue(medical?.genotype, "Unknown")}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-500">
                    You should verify this.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[18px] font-extrabold text-[#082F67]">
                Health history
              </Text>

              <View className="mt-2">
                <DetailRow
                  title="Chronic conditions"
                  subtitle={displayValue(
                    medical?.conditions,
                    "No conditions added",
                  )}
                  onPress={() => actions.setTab("profile")}
                />
                <DetailRow
                  title="Medications"
                  subtitle={displayValue(
                    medical?.medications,
                    "No medication list added",
                  )}
                  onPress={() => actions.setTab("profile")}
                />
                <DetailRow
                  title="Allergies"
                  subtitle={hasAllergies ? allergyText : "Not recorded"}
                  onPress={() => actions.setTab("profile")}
                />
                <DetailRow
                  title="Surgeries"
                  subtitle={displayValue(
                    medical?.surgeries,
                    "No surgery history added",
                  )}
                  onPress={() => actions.setTab("profile")}
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[18px] font-extrabold text-[#082F67]">
                Vaccines & immunizations
              </Text>
              <TouchableOpacity
                activeOpacity={0.76}
                onPress={actions.openUpload}
                className="mt-3 flex-row items-center rounded-2xl border border-slate-200 p-4"
              >
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-[#173B68]">
                    Add an immunization record
                  </Text>
                  <Text className="mt-1 text-[12px] leading-[17px] text-slate-500">
                    Upload a vaccination card so it is ready for care visits.
                  </Text>
                </View>
                <ChevronIcon />
              </TouchableOpacity>
            </View>

            <View className="rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Personal safety note
              </Text>
              <Text className="mt-2 text-[12px] leading-[18px] text-[#536A84]">
                Review your medical details regularly. These entries support
                care conversations but do not replace professional diagnosis.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="mb-4 flex-row items-end justify-between">
              <View>
                <Text className="text-[18px] font-extrabold text-[#082F67]">
                  My documents
                </Text>
                <Text className="mt-1 text-[12px] text-slate-500">
                  Patient-uploaded collection · {ownedRecords.length}{" "}
                  {ownedRecords.length === 1 ? "document" : "documents"}
                </Text>
              </View>
            </View>

            {ownedRecords.length === 0 ? (
              <View className="mb-5 items-center rounded-2xl border border-dashed border-slate-200 px-6 py-10">
                <Text className="text-[14px] font-bold text-[#173B68]">
                  No documents uploaded
                </Text>
                <Text className="mt-2 max-w-[260px] text-center text-[12px] leading-[18px] text-slate-500">
                  Upload a report or prescription to keep a copy in your record.
                </Text>
              </View>
            ) : (
              <View className="mb-5 gap-3">
                {ownedRecords.map((record) => {
                  const meta =
                    RECORD_META[record.type] ??
                    ({ emoji: "📄", tint: "#EEF3FA" } as any);

                  return (
                    <TouchableOpacity
                      key={record.id}
                      activeOpacity={0.76}
                      onPress={() => actions.openRecord(record.id)}
                      className="flex-row items-center rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <View
                        className="h-11 w-11 items-center justify-center rounded-xl"
                        style={{ backgroundColor: meta.tint }}
                      >
                        <Text className="text-[18px]">{meta.emoji}</Text>
                      </View>

                      <View className="ml-3 flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-[14px] font-bold text-[#173B68]"
                        >
                          {record.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="mt-1 text-[11.5px] text-slate-500"
                        >
                          {record.provider} · {record.date}
                        </Text>
                      </View>

                      <ChevronIcon />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={actions.openUpload}
              className="min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Upload a document
              </Text>
            </TouchableOpacity>

            <Text className="mx-2 mt-3 text-[11.5px] leading-[17px] text-slate-500">
              Text extraction (OCR) helps read uploads. An uploaded document is
              not a verified clinical result.
            </Text>

            {memberPrescriptions.length > 0 ? (
              <View className="mt-7">
                <Text className="text-[18px] font-extrabold text-[#082F67]">
                  Prescriptions
                </Text>
                <View className="mt-3 gap-3">
                  {memberPrescriptions.map((rx) => (
                    <View key={rx.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <Text className="text-[14px] font-bold text-[#173B68]">{rx.medicationName}</Text>
                      <Text className="mt-1 text-[12px] text-slate-500">
                        {[rx.dosage, rx.frequency].filter(Boolean).join(" · ") || "Dosage not recorded"}
                      </Text>
                      <Text className="mt-1 text-[11.5px] text-slate-500">
                        {rx.prescriber ? `${rx.prescriber} · ` : ""}Refills left {rx.refillsRemaining} of {rx.refillsTotal}
                      </Text>
                      {rx.refillsRemaining > 0 ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => actions.openRefillModal(rx.id)}
                          className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-[#082F67]"
                        >
                          <Text className="text-[13px] font-semibold text-white">Request refill</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="mt-7">
              <Text className="text-[18px] font-extrabold text-[#082F67]">
                Facility results
              </Text>
              <Text className="mt-1 text-[12px] text-slate-500">
                Sent by your labs and clinics · {facilityRecords.length}{" "}
                {facilityRecords.length === 1 ? "result" : "results"}
              </Text>

              {facilityRecords.length === 0 ? (
                <View className="mt-3 rounded-2xl bg-[#E7EDF8] p-4">
                  <Text className="text-[12px] leading-[18px] text-[#516881]">
                    No facility results yet. Lab results, vitals and
                    prescriptions shared by your care providers appear here.
                  </Text>
                </View>
              ) : (
                <View className="mt-3 gap-3">
                  {facilityRecords.map((record) => {
                    const meta =
                      RECORD_META[record.type] ??
                      ({ emoji: "📄", tint: "#EEF3FA" } as any);

                    return (
                      <TouchableOpacity
                        key={record.id}
                        activeOpacity={0.76}
                        onPress={() => actions.openRecord(record.id)}
                        className="flex-row items-center rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        <View
                          className="h-11 w-11 items-center justify-center rounded-xl"
                          style={{ backgroundColor: meta.tint }}
                        >
                          <Text className="text-[18px]">{meta.emoji}</Text>
                        </View>

                        <View className="ml-3 flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-[14px] font-bold text-[#173B68]"
                          >
                            {record.title}
                          </Text>
                          <Text
                            numberOfLines={2}
                            className="mt-1 text-[11.5px] text-slate-500"
                          >
                            {record.provider} · {record.date}
                            {record.summary ? ` · ${record.summary}` : ""}
                          </Text>
                        </View>

                        <ChevronIcon />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}
