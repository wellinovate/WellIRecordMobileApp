import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg,{Path} from "react-native-svg";
import type { CareFacility } from "../data/types";

const Back=()=> <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"><Path d="M15 18L9 12L15 6" stroke="#172033" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;

export function FacilityDetailsModal({visible,facility,onClose,onBook}:{visible:boolean;facility:CareFacility|null;onClose:()=>void;onBook:()=>void}) {
  if(!facility) return null;
  const f=facility as any;
  return <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{paddingHorizontal:16,paddingTop:8,paddingBottom:32}} showsVerticalScrollIndicator={false}>
        <View className="min-h-[44px] flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"><Back/></TouchableOpacity>
          <Text className="text-[12px] font-semibold text-slate-800">WelliRecord<Text className="text-[7px]">™</Text></Text><View className="h-9 w-9"/>
        </View>

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">Facility details</Text>
        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">{facility.name}</Text>
        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">{f.typeLabel||facility.type||"Clinic"} · {facility.specialty||"General care"}</Text>

        <View className="mt-6 rounded-2xl bg-[#EEF3FA] p-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">Demo facility</Text>
          <Text className="mt-2 text-[14px] font-bold text-[#173B68]">{facility.name}</Text>
          <Text className="mt-1 text-[11.5px] leading-[17px] text-[#536A84]">{f.address||"Illustrative care location · no live facility connection"}</Text>
        </View>

        <Text className="mt-6 text-[18px] font-extrabold text-[#082F67]">Care categories</Text>
        <View className="mt-3 rounded-2xl border border-slate-200 px-4">
          {[
            ["General consultations",facility.specialty||"Primary and outpatient care"],
            ["Follow-up visits","Review an existing concern, treatment plan or recent test."],
            ["Routine care","Illustrative preventive and routine-care availability."]
          ].map(([a,b],i)=><View key={a} className={`py-4 ${i<2?"border-b border-slate-100":""}`}><Text className="text-[13px] font-bold text-[#173B68]">{a}</Text><Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">{b}</Text></View>)}
        </View>

        <Text className="mt-6 text-[18px] font-extrabold text-[#082F67]">Hours & availability</Text>
        <View className="mt-3 rounded-2xl border border-slate-200 p-4"><Text className="text-[13px] font-bold text-[#173B68]">Demo availability</Text><Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">Appointment times are illustrative until live facility schedules are connected.</Text></View>

        <TouchableOpacity onPress={onBook} className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"><Text className="text-[14px] font-semibold text-white">Plan a demo visit</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose} className="mt-2 min-h-[44px] items-center justify-center"><Text className="text-[13px] font-semibold text-slate-500">Back to care search</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
