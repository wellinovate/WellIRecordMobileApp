import { useMemo, useState } from "react";

import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '../components/ActivityModal';

import { SafeAreaView } from "react-native-safe-area-context";

import Svg, { Path } from "react-native-svg";

import {

  pickDocument,

  pickImageFromCamera,

  type PickedMediaResult,

} from "../utils/mediaPicker";

import { ocrService, type OcrResult } from "../services/ocrService";
import { recordsService, type UploadedRecordFile } from "../services/recordsService";

import type { RecordType } from "../data/types";

import type { WelliApp } from "../state/useWelliApp";



interface OcrPreset {

  type: RecordType;

  label: string;

}



const OCR_PRESETS: OcrPreset[] = [

  { type: "Clinical Note", label: "Administrative note" },

  { type: "Lab Result", label: "Lab result" },

  { type: "Prescription", label: "Prescription" },

  { type: "Immunization", label: "Immunization record" },

  { type: "Imaging", label: "Imaging / scan" },

  { type: "Receipt", label: "Medical receipt" },

];



type SourceType = "camera" | "file" | null;



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



function Header({

  title = "WelliRecord",

  onBack,

}: {

  title?: string;

  onBack: () => void;

}) {

  return (

    <View className="min-h-[44px] flex-row items-center justify-between">

      <TouchableOpacity

        activeOpacity={0.7}

        onPress={onBack}

        className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"

      >

        <BackIcon />

      </TouchableOpacity>



      <Text className="text-[12px] font-semibold text-slate-800">

        {title}

        <Text className="text-[7px]">™</Text>

      </Text>



      <View className="h-9 w-9" />

    </View>

  );

}



export function UploadModal({ app }: { app: WelliApp }) {

  const { state, actions } = app;



  const [source, setSource] = useState<SourceType>(null);

  const [pickedFile, setPickedFile] = useState<PickedMediaResult | null>(null);

  const [selectedPreset, setSelectedPreset] = useState<OcrPreset>(

    OCR_PRESETS[0],

  );

  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  const [documentTitle, setDocumentTitle] = useState("My document.pdf");

  const [provider, setProvider] = useState("");

  const [extractedText, setExtractedText] = useState("");

  const [editingExtractedText, setEditingExtractedText] = useState(false);

  const [uploadedFile, setUploadedFile] = useState<UploadedRecordFile | null>(null);
  const [readNote, setReadNote] = useState("");
  const [uploadFailed, setUploadFailed] = useState(false);

  const [failureMessage, setFailureMessage] = useState(

    "We couldn't finish this upload. Check your connection and try again.",

  );



  const fileDisplayName = useMemo(

    () => pickedFile?.name || documentTitle || "My document.pdf",

    [pickedFile?.name, documentTitle],

  );



  if (!state.showUpload) return null;



  const reset = () => {

    setSource(null);

    setPickedFile(null);

    setOcrResult(null);

    setDocumentTitle("My document.pdf");

    setProvider("");

    setExtractedText("");

        setEditingExtractedText(false);
    setUploadedFile(null);
    setReadNote("");
    setUploadFailed(false);
    setFailureMessage(
      "We couldn't finish this upload. Check your connection and try again.",
    );
  };
  const close = () => {

    reset();

    actions.closeUpload();

  };



  const returnToSelect = () => {

    setUploadFailed(false);

    setEditingExtractedText(false);

        setPickedFile(null);
    setOcrResult(null);
    setUploadedFile(null);
    setReadNote("");
    setExtractedText("");
    actions.openUpload();

  };



  // Saves the file first, so it is never lost. Reading text from a photo is only a help: if it finds nothing,
  // or the file is a PDF or another kind of document, the person fills in the details by hand.
  const analyzeFile = async (result: PickedMediaResult) => {
    setUploadFailed(false);
    setPickedFile(result);
    setOcrResult(null);
    setUploadedFile(null);
    setReadNote("");
    setDocumentTitle(
      (result.name || "My document").replace(/\.[^/.]+$/, "") || "My document",
    );
    actions.setUploadStepScanning();

    let saved: UploadedRecordFile;
    try {
      saved = await recordsService.uploadFile(result, state.activeFamilyId);
    } catch (error: any) {
      setFailureMessage(
        error?.message ||
          "We couldn't finish this upload. Check your connection and try again.",
      );
      setUploadFailed(true);
      return;
    }
    setUploadedFile(saved);

    const isImage =
      /^image\/(jpeg|png|webp)$/.test(saved.contentType) &&
      saved.bytes < 9_000_000;
    if (!isImage) {
      setReadNote(
        "This file is saved. Add a title and a short note so you can find it later.",
      );
      actions.setUploadStepReview();
      return;
    }

    // Photo scanning sends the photo to outside services, so it only runs when the server says it is on (it is off by default).
    if (!(await ocrService.available())) {
      setReadNote(
        "This file is saved. Add a title and a short note so you can find it later.",
      );
      actions.setUploadStepReview();
      return;
    }

    try {
      const extracted = await ocrService.extractFromImage(
        result,
        selectedPreset.type,
      );
      if (extracted?.success) {
        setOcrResult(extracted);
        setDocumentTitle(
          extracted.title ||
            result.name?.replace(/\.[^/.]+$/, "") ||
            "My document",
        );
        setProvider(extracted.provider || "");
        setExtractedText(
          extracted.summary ||
            extracted.keyValues
              ?.map((item) => `${item.label}: ${item.value}`)
              .join("\n") ||
            "",
        );
      } else {
        setReadNote(
          "The file is saved, but no text could be read from it. Add a title and a short note by hand.",
        );
      }
    } catch (error: any) {
      setReadNote(
        `The file is saved. ${error?.message || "Text could not be read from it"}. Add a title and a short note by hand.`,
      );
    }
    actions.setUploadStepReview();
  };

  const chooseSourceAndUpload = async () => {

    if (!source) {

      actions.showToast("Choose a photo or file first");

      return;

    }



    const result =

      source === "camera"

        ? await pickImageFromCamera(false)

        : await pickDocument();



    if (!result?.uri) return;



    await analyzeFile(result);

  };



  const retryUpload = async () => {
    if (!pickedFile) {
      returnToSelect();
      return;
    }

    await analyzeFile(pickedFile);
  };



  const saveRecord = () => {

    actions.addRecord({

      ownerId: state.activeFamilyId,

      title: documentTitle.trim() || "My document",

      date: new Date().toLocaleDateString("en-US", {

        month: "short",

        day: "2-digit",

        year: "numeric",

      }),

      type: selectedPreset.type,

      provider: provider.trim() || "Patient upload",

      summary:

        extractedText.trim() ||

        ocrResult?.summary ||

        "Patient-uploaded document.",

            extractedOcr: ocrResult?.keyValues?.length
        ? { keyValues: ocrResult.keyValues, statusBadge: "OCR Extracted" }
        : undefined,
      attachments: uploadedFile
        ? [
            {
              url: `/records/files/${uploadedFile.id}`,
              name: uploadedFile.name,
              fileType: uploadedFile.contentType,
            },
          ]
        : undefined,
      fileIds: uploadedFile ? [uploadedFile.id] : undefined,
    });



    close();

  };



  const renderFailed = () => (

    <ScrollView

      className="flex-1"

      contentContainerStyle={{

        paddingHorizontal: 16,

        paddingTop: 8,

        paddingBottom: 32,

      }}

      showsVerticalScrollIndicator={false}

    >

      <Header onBack={returnToSelect} />



      <Text className="mt-4 text-[28px] leading-[34px] font-extrabold text-[#082F67]">

        Upload interrupted

      </Text>



      <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">

        Your document wasn't fully added to your record.

      </Text>



      <View className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">

        <Text className="text-[13px] font-bold text-red-700">

          Upload interrupted

        </Text>

        <Text className="mt-2 text-[11.5px] leading-[17px] text-red-600">

          {failureMessage}

        </Text>

      </View>



      <View className="mt-4 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">

        <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">

          My document

        </Text>

        <Text className="mt-2 text-[14px] font-bold text-[#173B68]">

          {fileDisplayName}

        </Text>

        <Text className="mt-1 text-[11.5px] text-slate-500">

          {selectedPreset.label}

        </Text>

      </View>



      <TouchableOpacity

        activeOpacity={0.86}

        onPress={retryUpload}

        className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"

      >

        <Text className="text-[14px] font-semibold text-white">

          Retry upload

        </Text>

      </TouchableOpacity>



      <TouchableOpacity

        activeOpacity={0.75}

        onPress={() => {

          setPickedFile(null);

          setUploadFailed(false);

          actions.openUpload();

        }}

        className="mt-3 min-h-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white"

      >

        <Text className="text-[13px] font-semibold text-[#315B90]">

          Choose another file

        </Text>

      </TouchableOpacity>

    </ScrollView>

  );



  return (

    <Modal

      visible={state.showUpload}

      animationType="slide"

      transparent={false}

      onRequestClose={close}

    >

      <SafeAreaView className="flex-1 bg-white">

        {uploadFailed ? (

          renderFailed()

        ) : state.uploadStep === 0 ? (

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



            <Text className="mt-4 text-[28px] leading-[34px] font-extrabold text-[#082F67]">

              Add a document

            </Text>



            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">

              Keep a copy in your patient-uploaded documents.

            </Text>



            <View className="mt-6 rounded-2xl bg-[#EEF3FA] p-4">

              <Text className="text-[13px] font-bold text-[#173B68]">

                Choose a source

              </Text>



              <View className="mt-3 gap-3">

                <TouchableOpacity

                  activeOpacity={0.8}

                  onPress={() => setSource("camera")}

                  className={`rounded-xl border p-4 ${

                    source === "camera"

                      ? "border-[#315B90] bg-white"

                      : "border-transparent bg-white/60"

                  }`}

                >

                  <Text className="text-[13px] font-semibold text-[#173B68]">

                    Take a photo

                  </Text>

                </TouchableOpacity>



                <TouchableOpacity

                  activeOpacity={0.8}

                  onPress={() => setSource("file")}

                  className={`rounded-xl border p-4 ${

                    source === "file"

                      ? "border-[#315B90] bg-white"

                      : "border-transparent bg-white/60"

                  }`}

                >

                  <Text className="text-[13px] font-semibold text-[#173B68]">

                    Choose a file

                  </Text>

                </TouchableOpacity>

              </View>

            </View>



            <View className="mt-5">

              <Text className="text-[12px] font-semibold text-[#173B68]">

                Document category

              </Text>



              <ScrollView

                horizontal

                showsHorizontalScrollIndicator={false}

                className="mt-2"

              >

                <View className="flex-row gap-2 pr-4">

                  {OCR_PRESETS.map((preset) => {

                    const active = selectedPreset.type === preset.type;



                    return (

                      <TouchableOpacity

                        key={preset.type}

                        activeOpacity={0.8}

                        onPress={() => setSelectedPreset(preset)}

                        className={`rounded-full border px-4 py-3 ${

                          active

                            ? "border-[#315B90] bg-[#EEF3FA]"

                            : "border-slate-200 bg-white"

                        }`}

                      >

                        <Text

                          className={`text-[12px] font-semibold ${

                            active ? "text-[#173B68]" : "text-slate-600"

                          }`}

                        >

                          {preset.label}

                        </Text>

                      </TouchableOpacity>

                    );

                  })}

                </View>

              </ScrollView>

            </View>



            <View className="mt-5 rounded-2xl border border-[#D7E2F1] bg-[#F3F6FB] p-4">

              <Text className="text-[13px] font-bold text-[#173B68]">

                Uploaded, not verified

              </Text>

              <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">

                This stays clearly labelled as a patient upload unless a

                connected provider verifies it.

              </Text>

            </View>



            <TouchableOpacity

              activeOpacity={0.86}

              onPress={chooseSourceAndUpload}

              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"

            >

              <Text className="text-[14px] font-semibold text-white">

                Upload document

              </Text>

            </TouchableOpacity>



            <TouchableOpacity

              activeOpacity={0.75}

              onPress={close}

              className="mt-2 min-h-[44px] items-center justify-center"

            >

              <Text className="text-[13px] font-semibold text-slate-500">

                Cancel

              </Text>

            </TouchableOpacity>

          </ScrollView>

        ) : state.uploadStep === 1 ? (

          <View className="flex-1 px-4 pb-6 pt-2">

            <Header onBack={returnToSelect} />



            <Text className="mt-4 text-[28px] leading-[34px] font-extrabold text-[#082F67]">

              Uploading document

            </Text>



            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">

              Your document is being added to your record.

            </Text>



            <View className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">

              <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">

                My document

              </Text>

              <Text className="mt-2 text-[14px] font-bold text-[#173B68]">

                {fileDisplayName}

              </Text>



              <View className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">

                <View className="h-full w-3/5 rounded-full bg-[#315B90]" />

              </View>



              <Text className="mt-2 text-[11px] text-slate-500">

                Uploading and extracting text…

              </Text>

            </View>



            <View className="mt-4 rounded-2xl bg-[#EEF3FA] p-4">

              <Text className="text-[13px] font-bold text-[#173B68]">

                Text review comes next

              </Text>

              <Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">

                                Your file is saved first. Text is read from photos when it
                can be, and you review it before saving.

              </Text>

            </View>



            <TouchableOpacity

              activeOpacity={0.75}

              onPress={close}

              className="mt-auto min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"

            >

              <Text className="text-[13px] font-semibold text-[#315B90]">

                Cancel upload

              </Text>

            </TouchableOpacity>

          </View>

        ) : (

          <ScrollView

            className="flex-1"

            contentContainerStyle={{

              paddingHorizontal: 16,

              paddingTop: 8,

              paddingBottom: 32,

            }}

            showsVerticalScrollIndicator={false}

          >

            <Header onBack={returnToSelect} />



            <Text className="mt-4 text-[28px] leading-[34px] font-extrabold text-[#082F67]">

              Review extracted text

            </Text>



            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">

              Check the details before adding this document to your record.

            </Text>



            <View className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">

              <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">

                My document.pdf

              </Text>

              <Text className="mt-2 text-[14px] font-bold text-[#173B68]">

                {fileDisplayName}

              </Text>

              <Text className="mt-1 text-[11.5px] text-slate-500">

                {selectedPreset.label}

              </Text>

            </View>



            <View className="mt-4">

              <Text className="text-[12px] font-semibold text-[#173B68]">

                Category

              </Text>

              <View className="mt-2 min-h-[46px] justify-center rounded-xl border border-slate-200 px-3">

                <Text className="text-[14px] text-slate-900">

                  {selectedPreset.label}

                </Text>

              </View>

            </View>



            <View className="mt-4">

                            <Text className="text-[12px] font-semibold text-[#173B68]">
                {ocrResult ? "Extracted text" : "Note"}
              </Text>
              {readNote ? (
                <Text className="mt-1 text-[12px] leading-[17px] text-[#536A84]">
                  {readNote}
                </Text>
              ) : null}



              <TextInput

                value={extractedText}

                onChangeText={setExtractedText}

                editable={editingExtractedText || !ocrResult}

                multiline

                textAlignVertical="top"

                placeholder="Add a short note (optional)"

                placeholderTextColor="#94A3B8"

                className={`mt-2 min-h-[150px] rounded-2xl border p-4 text-[13px] leading-[19px] ${

                  editingExtractedText

                    ? "border-[#315B90] bg-white text-slate-900"

                    : "border-slate-200 bg-[#F8FAFD] text-slate-700"

                }`}

              />



              <Text className="mt-2 text-[10.5px] leading-[15px] text-slate-500">

                Extracted information is editable before it becomes part of your

                patient-uploaded record.

              </Text>

            </View>



            <TouchableOpacity

              activeOpacity={0.8}

              onPress={() => setEditingExtractedText((current) => !current)}

              className="mt-4 min-h-[46px] items-center justify-center rounded-xl bg-[#EEF3FA]"

            >

              <Text className="text-[13px] font-semibold text-[#315B90]">

                {editingExtractedText

                  ? "Finish editing"

                  : "Edit extracted text"}

              </Text>

            </TouchableOpacity>



            <TouchableOpacity

              activeOpacity={0.86}

              onPress={saveRecord}

              className="mt-3 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"

            >

              <Text className="text-[14px] font-semibold text-white">

                Save medical document

              </Text>

            </TouchableOpacity>



            <TouchableOpacity

              activeOpacity={0.75}

              onPress={returnToSelect}

              className="mt-2 min-h-[44px] items-center justify-center"

            >

              <Text className="text-[13px] font-semibold text-slate-500">

                Back to document

              </Text>

            </TouchableOpacity>

          </ScrollView>

        )}

      </SafeAreaView>

    </Modal>

  );

}
