import React, { useState } from "react";
import {
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { LogoMark } from "../components/Logo";
import type { WelliApp } from "../state/useWelliApp";

type AccessDuration = "15m" | "1h" | "24h";

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

function QrPlaceholder() {
  return (
    <View className="h-[108px] w-[108px] items-center justify-center rounded-xl border border-slate-200 bg-white">
      <Svg width={74} height={74} viewBox="0 0 74 74" fill="none">
        <Rect x="2" y="2" width="22" height="22" rx="2" stroke="#315B90" strokeWidth="3" />
        <Rect x="50" y="2" width="22" height="22" rx="2" stroke="#315B90" strokeWidth="3" />
        <Rect x="2" y="50" width="22" height="22" rx="2" stroke="#315B90" strokeWidth="3" />
        <Path d="M31 4H40V13H31V4ZM31 18H45V27H31V18ZM50 31H72V40H50V31ZM31 34H40V49H31V34ZM45 45H55V55H45V45ZM59 47H72V60H59V47ZM31 59H43V72H31V59ZM50 62H57V72H50V62Z" fill="#315B90" />
      </Svg>
    </View>
  );
}

export function ShareScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [shareDocuments, setShareDocuments] = useState(true);
  const [shareEmergencyId, setShareEmergencyId] = useState(false);
  const [duration, setDuration] = useState<AccessDuration>("1h");

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
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
            WelliBridge · Share
          </Text>
        </View>

        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
          Share on your terms
        </Text>

        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
          Give a provider access only to what you choose, for a limited time.
        </Text>

        <View className="mt-6">
          <Text className="text-[18px] font-extrabold text-[#082F67]">
            Choose what to share
          </Text>

          <View className="mt-3 rounded-2xl border border-slate-200 bg-white">
            <View className="flex-row items-center px-4 py-4">
              <View className="flex-1 pr-4">
                <Text className="text-[14px] font-semibold text-[#173B68]">
                  Patient-uploaded documents
                </Text>
                <Text className="mt-1 text-[11.5px] leading-[16px] text-slate-500">
                  Your reports, scans and uploaded files.
                </Text>
              </View>

              <Switch
                value={shareDocuments}
                onValueChange={setShareDocuments}
                trackColor={{ false: "#D9E0E9", true: "#315B90" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="h-px bg-slate-100" />

            <View className="flex-row items-center px-4 py-4">
              <View className="flex-1 pr-4">
                <Text className="text-[14px] font-semibold text-[#173B68]">
                  Emergency Medical ID
                </Text>
                <Text className="mt-1 text-[11.5px] leading-[16px] text-slate-500">
                  Allergy status and emergency-safe details.
                </Text>
              </View>

              <Switch
                value={shareEmergencyId}
                onValueChange={setShareEmergencyId}
                trackColor={{ false: "#D9E0E9", true: "#315B90" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View className="mt-3 rounded-xl bg-[#EEF3FA] p-3">
            <Text className="text-[11.5px] leading-[16px] text-[#536A84]">
              We help you understand what each share includes. You can review
              everything before granting access.
            </Text>
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[18px] font-extrabold text-[#082F67]">
            Access duration
          </Text>

          <View className="mt-3 flex-row rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              ["15m", "15 mins"],
              ["1h", "1 hour"],
              ["24h", "24 hours"],
            ].map(([value, label]) => {
              const active = duration === value;

              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.8}
                  onPress={() => setDuration(value as AccessDuration)}
                  className={`flex-1 items-center rounded-lg py-3 ${
                    active ? "bg-[#082F67]" : ""
                  }`}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      active ? "text-white" : "text-[#315B90]"
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="mt-2 text-[11px] leading-[16px] text-slate-500">
            Choose the shortest access period that works for this visit.
          </Text>
        </View>

        <View className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">
          <Text className="text-[16px] font-extrabold text-[#082F67]">
            Get secure access link
          </Text>

          <View className="mt-4 flex-row items-center gap-4">
            <QrPlaceholder />

            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-[#173B68]">
                Scan or share securely
              </Text>
              <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                A provider can use the secure link after you confirm the final
                consent screen.
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#EEF3FA] p-4">
          <Text className="text-[14px] font-bold text-[#173B68]">
            Connect this visit
          </Text>
          <Text className="mt-1 text-[11.5px] leading-[17px] text-[#536A84]">
            Only the information you select will be included in the consent
            summary.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => actions.openShareFlow()}
          className="mt-5 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"
        >
          <Text className="text-[14px] font-semibold text-white">
            Choose recipient to continue
          </Text>
        </TouchableOpacity>

        <Text className="mt-3 text-center text-[10.5px] text-slate-400">
          Illustrative sharing UI · backend authorization comes later
        </Text>
      </ScrollView>
    </View>
  );
}
