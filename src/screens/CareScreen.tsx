import React, { useMemo, useState } from "react";
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
import { DoctorDetailsModal, type DoctorDetailsModel } from "../modals/DoctorDetailsModal";
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

function IllustrativeMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 140">
      <Path
        d="M0 20C55 20 70 38 113 36C165 33 189 6 245 12C276 15 299 27 320 32"
        stroke="#EAF4F0"
        strokeWidth={12}
        fill="none"
      />
      <Path
        d="M18 140C50 100 73 83 120 79C167 75 198 93 227 75C251 60 264 37 272 0"
        stroke="#EAF4F0"
        strokeWidth={11}
        fill="none"
      />
      <Path
        d="M0 87C45 86 74 98 111 108C156 120 199 123 241 112C268 105 292 94 320 95"
        stroke="#EAF4F0"
        strokeWidth={9}
        fill="none"
      />
      <Circle cx={185} cy={52} r={7} fill="#497D78" />
      <Circle cx={185} cy={52} r={3} fill="#FFFFFF" />
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
            {facility.type} · {facility.specialty}
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
            Services, availability and demo booking
          </Text>
        </View>

        <ChevronWhite />
      </TouchableOpacity>
    </View>
  );
}

function ClinicianCard({
  doctor,
  onPress,
}: {
  doctor: DoctorDetailsModel;
  onPress: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <View className="flex-row items-center p-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF3FA]">
          <Text className="text-[13px] font-bold text-[#315B90]">
            {doctor.initials || "DC"}
          </Text>
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-[14px] font-bold text-[#173B68]">
            {doctor.name}
          </Text>

          <Text className="mt-1 text-[11.5px] text-slate-500">
            {doctor.specialty || "Clinician"} ·{" "}
            {doctor.org || "Demo Community Clinic"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        className="flex-row items-center justify-between bg-[#082F67] px-4 py-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-semibold text-white">
            View clinician details
          </Text>

          <Text className="mt-1 text-[11px] text-[#A8BCD5]">
            Appointment options and demo availability
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

  const [selectedDoctor, setSelectedDoctor] =
    useState<DoctorDetailsModel | null>(null);

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

  const exampleFacilities = filteredFacilities.slice(0, 2);

  const demoDoctor = useMemo<DoctorDetailsModel>(() => {
    const firstFacility = exampleFacilities[0];

    return {
      id: "demo-clinician",
      name: "Demo clinician",
      initials: "DC",
      specialty: firstFacility?.specialty || "Primary care",
      org: firstFacility?.name || "Demo Community Clinic",
    };
  }, [exampleFacilities]);

  const handleSearch = () => {
    Keyboard.dismiss();
  };

  const openFacilityBooking = (facility: CareFacility) => {
    setSelectedFacility(null);
    actions.openBookAppointment(facility.id);
  };

  const openDoctorBooking = (doctor: DoctorDetailsModel) => {
    const organization = (doctor.org || "").toLowerCase();

    const matchingFacility = facilities.find((facility) => {
      const facilityName = facility.name.toLowerCase();

      return (
        facilityName === organization ||
        facilityName.includes(organization) ||
        organization.includes(facilityName)
      );
    });

    setSelectedDoctor(null);

    if (matchingFacility) {
      actions.openBookAppointment(matchingFacility.id);
      return;
    }

    if (facilities[0]) {
      actions.openBookAppointment(facilities[0].id);
      return;
    }

    actions.showToast(
      "Demo clinician booking will connect when a facility is available",
    );
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

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() =>
                actions.showToast(
                  "Location-based care search is not connected in this preview",
                )
              }
              className="min-h-[44px] justify-center"
            >
              <Text className="text-[13px] font-semibold text-[#315B90]">
                Use my location
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-5 h-[150px] overflow-hidden rounded-2xl bg-[#BFD8D0]">
          <IllustrativeMap />

          <View className="absolute bottom-2 left-2 rounded-lg bg-[#082F67] px-3 py-2">
            <Text className="text-[10.5px] font-medium text-white">
              Illustrative map · not live results
            </Text>
          </View>
        </View>

        <Text className="mt-6 text-[18px] font-extrabold text-[#082F67]">
          Example care options
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

            <ClinicianCard
              doctor={demoDoctor}
              onPress={() => setSelectedDoctor(demoDoctor)}
            />

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

        <Text className="mt-6 text-center text-[10.5px] text-slate-400">
          Illustrative demo · no connected clinical data
        </Text>
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

      <DoctorDetailsModal
        visible={Boolean(selectedDoctor)}
        doctor={selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        onBook={() => {
          if (selectedDoctor) {
            openDoctorBooking(selectedDoctor);
          }
        }}
        onContactFacility={() =>
          actions.showToast(
            "Facility contact options will be connected after the UI pass",
          )
        }
      />
    </View>
  );
}

export default CareScreen;
