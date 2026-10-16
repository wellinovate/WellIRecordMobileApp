import { useState } from "react";
import {
  Keyboard,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { CareFacility } from "../data/types";
import { FacilityDetailsModal } from "../modals/FacilityDetailsModal";
import type { WelliApp } from "../state/useWelliApp";

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

function SearchIcon({ white = false }: { white?: boolean }) {
  const color = white ? "#FFFFFF" : "#082F67";

  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={10.5}
        cy={10.5}
        r={6}
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M15 15L20 20"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ChevronWhite() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6L15 12L9 18"
        stroke="#FFFFFF"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}


function FacilityCard({
  facility,
  onPress,
}: {
  facility: CareFacility;
  onPress: () => void;
}) {
  const raw = facility as any;

  return (
    <View className="overflow-hidden rounded-2xl bg-[#082F67]">
      <View className="flex-row items-center px-4 py-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#244A7D]">
          <Text className="text-[18px]">{raw.emoji || "🏥"}</Text>
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-[14px] font-bold text-white" numberOfLines={1}>
            {facility.name}
          </Text>

          <Text
            className="mt-1 text-[11.5px] text-[#BFD0E5]"
            numberOfLines={1}
          >
            {[facility.type, facility.specialty].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        className="flex-row items-center justify-between border-t border-[#365984] px-4 py-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-semibold text-white">
            View facility details
          </Text>
          <Text className="mt-1 text-[11px] leading-[16px] text-[#A8BCD5]">
            Details and booking
          </Text>
        </View>

        <ChevronWhite />
      </TouchableOpacity>
    </View>
  );
}


export function CareScreen({ app }: { app: WelliApp }) {
  const { state, actions, facilities } = app;

  const [selectedFacility, setSelectedFacility] =
    useState<CareFacility | null>(null);

  const query = state.careQuery.trim().toLowerCase();

  const filteredFacilities = facilities.filter((facility) => {
    if (!query) return true;

    return (
      facility.name.toLowerCase().includes(query) ||
      facility.specialty.toLowerCase().includes(query) ||
      facility.leadName.toLowerCase().includes(query) ||
      facility.type.toLowerCase().includes(query)
    );
  });

  const exampleFacilities = filteredFacilities;


  const handleSearch = () => {
    Keyboard.dismiss();
  };

  const openFacilityBooking = (facility: CareFacility) => {
    setSelectedFacility(null);
    actions.openBookAppointment(facility.id);
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
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

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
          WelliRecord · Care
        </Text>

        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
          Find care near you
        </Text>

        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
          Look for a hospital, clinic or doctor.
        </Text>

        <View className="mt-6">
          <Text className="text-[12px] font-semibold text-[#173B68]">
            Search care
          </Text>

          <View className="mt-2 min-h-[48px] flex-row items-center rounded-xl border border-[#AFC3DD] px-3">
            <SearchIcon />

            <TextInput
              value={state.careQuery}
              onChangeText={actions.setCareQuery}
              placeholder="Hospital, clinic or doctor"
              placeholderTextColor="#778498"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              className="ml-2 flex-1 text-[14px] text-slate-900"
            />
          </View>

          <View className="mt-3 flex-row items-center gap-3">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSearch}
              className="min-h-[44px] flex-row items-center justify-center rounded-full bg-[#082F67] px-5"
            >
              <SearchIcon white />

              <Text className="ml-2 text-[13px] font-semibold text-white">
                Search
              </Text>
            </TouchableOpacity>

          </View>
        </View>


        <TouchableOpacity
          activeOpacity={0.82}
          onPress={actions.openUpcomingVisits}
          className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4"
        >
          <Text className="text-[14px] font-bold text-[#173B68]">
            My appointments
          </Text>
          <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
            {state.appointments.length
              ? `${state.appointments.length} requested or booked`
              : "View and cancel your appointment requests"}
          </Text>
        </TouchableOpacity>

        <View className="mt-3 flex-row gap-3">
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={actions.openPharmacyDirectory}
            className="flex-1 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4"
          >
            <Text className="text-[14px] font-bold text-[#173B68]">
              Pharmacies
            </Text>
            <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
              Find pharmacies on a map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={actions.openLabDirectory}
            className="flex-1 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4"
          >
            <Text className="text-[14px] font-bold text-[#173B68]">
              Diagnostic labs
            </Text>
            <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
              Find labs on a map
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="mt-6 text-[18px] font-extrabold text-[#082F67]">
          Registered facilities
        </Text>

        {exampleFacilities.length ? (
          <View className="mt-3 gap-3">
            {exampleFacilities.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                onPress={() => setSelectedFacility(facility)}
              />
            ))}


            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => actions.setTab("chat")}
              className="rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4"
            >
              <Text className="text-[14px] font-bold text-[#173B68]">
                Telemedicine
              </Text>

              <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                Explore remote care through the WelliRecord assistant.
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mt-3 items-center rounded-2xl border border-slate-200 px-6 py-8">
            <Text className="text-[14px] font-bold text-[#173B68]">
              No matching care options
            </Text>

            <Text className="mt-2 text-center text-[12px] leading-[18px] text-slate-500">
              Try another hospital, clinic, doctor or specialty.
            </Text>
          </View>
        )}

      </ScrollView>

      <FacilityDetailsModal
        visible={Boolean(selectedFacility)}
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        onBook={() => {
          if (selectedFacility) {
            openFacilityBooking(selectedFacility);
          }
        }}
      />

    </View>
  );
}

export default CareScreen;
