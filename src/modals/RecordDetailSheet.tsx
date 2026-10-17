import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { RECORD_META } from "../data/mockData";
import { hapticFeedback } from "../utils/haptics";
import type { WelliApp } from "../state/useWelliApp";
import { PdfViewerModal } from "./PdfViewerModal";
import { printRecord, shareRecord } from "../utils/recordFile";

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
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RecordDetailSheet({ app }: { app: WelliApp }) {
  const { state, actions, records, family } = app;
  const [pdfViewer, setPdfViewer] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [busy, setBusy] = useState<"share" | "print" | null>(null);

  const record = records.find((item) => item.id === state.recordDetailId);

  if (!record) return null;

  const patient =
    family.find((member) => member.id === record.ownerId) ?? family[0];

  const meta =
    RECORD_META[record.type] ??
    ({ emoji: "📄", tint: "#EEF3FA" } as any);

  const firstAttachment = record.attachments?.[0];

  const openPreview = () => {
    hapticFeedback.light();

    if (firstAttachment?.url) {
      setPdfViewer({
        url: firstAttachment.url,
        title: firstAttachment.name || record.title,
      });
      return;
    }

    actions.showToast("This record has no document attached");
  };

  const patientName = patient?.name || "Patient";
  const isFacility = record.source === "facility";

  const sendOut = () => {
    hapticFeedback.light();
    Alert.alert(
      "Send this result?",
      "It leaves WelliRecord and goes to the app you choose, such as WhatsApp. That app's own privacy terms apply.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            setBusy("share");
            try {
              await shareRecord(record, patientName);
            } catch (err: any) {
              actions.showToast(err?.message || "Could not open the share sheet. Try again.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const print = async () => {
    hapticFeedback.light();
    setBusy("print");
    try {
      await printRecord(record, patientName);
    } catch (err: any) {
      actions.showToast(err?.message || "Could not print this result. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Modal
        visible={Boolean(state.recordDetailId)}
        animationType="slide"
        transparent={false}
        onRequestClose={actions.closeRecord}
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
            <View className="min-h-[44px] flex-row items-center justify-between">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.closeRecord}
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
              {isFacility ? "Documents · Facility result" : "Documents · Patient upload"}
            </Text>

            <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
              Document details
            </Text>

            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Review the source and details attached to this document.
            </Text>

            <View className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">
              <View className="flex-row items-start gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: meta.tint }}
                >
                  <Text className="text-[18px]">{meta.emoji}</Text>
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {firstAttachment?.name || (isFacility ? "Facility result" : "Document")}
                  </Text>

                  <Text className="mt-1 text-[15px] font-extrabold text-[#173B68]">
                    {record.title}
                  </Text>

                  <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                    {record.provider} · {record.date}
                  </Text>
                </View>
              </View>

              <View className="mt-4 h-px bg-slate-200" />

              <View className="mt-4 gap-4">
                <View>
                  <Text className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </Text>
                  <Text className="mt-1 text-[13px] font-semibold text-[#173B68]">
                    {record.type}
                  </Text>
                </View>

                <View>
                  <Text className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    Added
                  </Text>
                  <Text className="mt-1 text-[13px] font-semibold text-[#173B68]">
                    {record.date}
                  </Text>
                </View>

                <View>
                  <Text className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </Text>
                  <Text className="mt-1 text-[13px] font-semibold text-[#173B68]">
                    {isFacility ? "Facility result" : "Patient upload"}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">
                Summary
              </Text>

              <Text className="mt-3 text-[13px] leading-[20px] text-[#173B68]">
                {record.summary ||
                  "This patient-uploaded document does not yet have a written summary."}
              </Text>
            </View>

            {record.extractedOcr?.keyValues?.length ? (
              <View className="mt-4 rounded-2xl border border-slate-200 p-4">
                <Text className="text-[13px] font-extrabold text-[#082F67]">
                  Extracted details
                </Text>

                <View className="mt-3 gap-3">
                  {record.extractedOcr.keyValues.map((item) => (
                    <View
                      key={`${item.label}-${item.value}`}
                      className="flex-row items-start justify-between gap-4"
                    >
                      <Text className="flex-1 text-[12px] text-slate-500">
                        {item.label}
                      </Text>
                      <Text className="flex-1 text-right text-[12px] font-semibold text-[#173B68]">
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#F3F6FB] p-4">
              <Text className="text-[13px] font-bold text-[#173B68]">
                {isFacility ? "Sent by your facility" : "Patient-uploaded document"}
              </Text>
              <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">
                {isFacility
                  ? `This result was sent to ${patient?.name || "the patient"}'s record by ${record.provider}.`
                  : `This record belongs to ${patient?.name || "the patient"} and is not automatically treated as a verified clinical result.`}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => actions.shareThisRecord(record.id)}
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
            >
              <Text className="text-[14px] font-semibold text-white">
                Share with WelliBridge
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openPreview}
              className="mt-3 min-h-[48px] flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Open document preview
              </Text>
              <ChevronIcon />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={busy !== null}
              onPress={sendOut}
              className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white"
            >
              {busy === "share" ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-[13px] font-semibold text-[#315B90]">
                  Send via WhatsApp or another app
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={busy !== null}
              onPress={print}
              className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white"
            >
              {busy === "print" ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-[13px] font-semibold text-[#315B90]">
                  Print or save as PDF
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <PdfViewerModal
        visible={Boolean(pdfViewer)}
        url={pdfViewer?.url || null}
        title={pdfViewer?.title}
        onClose={() => setPdfViewer(null)}
      />
    </>
  );
}
