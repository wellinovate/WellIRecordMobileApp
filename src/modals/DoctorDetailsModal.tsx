import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg,{Path} from "react-native-svg";

export interface DoctorDetailsModel { id:string; name:string; initials?:string; specialty?:string; org?:string; }
const Back=()=> <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"><Path d="M15 18L9 12L15 6" stroke="#172033" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;

export function DoctorDetailsModal({visible,doctor,onClose,onBook,onCall}:{visible:boolean;doctor:DoctorDetailsModel|null;onClose:()=>void;onBook:()=>void;onCall?:(()=>void)|null}) {
  if(!doctor) return null;
  const initials=doctor.initials||doctor.name.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  return <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{paddingHorizontal:16,paddingTop:8,paddingBottom:32}} showsVerticalScrollIndicator={false}>
        <View className="min-h-[44px] flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"><Back/></TouchableOpacity>
          <Text className="text-[12px] font-semibold text-slate-800">WelliRecord<Text className="text-[7px]">™</Text></Text><View className="h-9 w-9"/>
        </View>

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">Clinician details</Text>
        <View className="mt-5 flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EEF3FA]"><Text className="text-[16px] font-extrabold text-[#315B90]">{initials}</Text></View>
          <View className="flex-1"><Text className="text-[26px] leading-[31px] font-extrabold text-[#082F67]">{doctor.name}</Text><Text className="mt-1 text-[13px] leading-[19px] text-slate-500">{[doctor.specialty,doctor.org].filter(Boolean).join(" · ")}</Text></View>
        </View>

        <View className="mt-6 rounded-2xl bg-[#EEF3FA] p-4"><Text className="text-[11px] font-semibold uppercase tracking-wide text-[#607189]">Care organization</Text><Text className="mt-2 text-[14px] font-bold text-[#173B68]">{doctor.org||"Not listed"}</Text><Text className="mt-1 text-[11.5px] leading-[17px] text-[#536A84]">Appointments are requested with the organization. It confirms the date and time.</Text></View>

        <TouchableOpacity onPress={onBook} className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]"><Text className="text-[14px] font-semibold text-white">Request an appointment</Text></TouchableOpacity>
        {onCall ? <TouchableOpacity onPress={onCall} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-slate-200"><Text className="text-[13px] font-semibold text-[#315B90]">Call the organization</Text></TouchableOpacity> : null}
        <TouchableOpacity onPress={onClose} className="mt-2 min-h-[44px] items-center justify-center"><Text className="text-[13px] font-semibold text-slate-500">Back to care search</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
