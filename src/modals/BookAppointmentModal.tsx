import React,{useMemo,useState} from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg,{Path} from "react-native-svg";
import { hapticFeedback } from "../utils/haptics";
import type { WelliApp } from "../state/useWelliApp";

const TIMES=["09:30 AM","10:30 AM","01:00 PM","03:30 PM"];
const Back=()=> <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"><Path d="M15 18L9 12L15 6" stroke="#172033" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
const ymd=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const label=(d:Date)=>d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
function daysFor(m:Date){const y=m.getFullYear(),mi=m.getMonth(),first=new Date(y,mi,1),start=new Date(y,mi,1-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {date:d,value:ymd(d),n:d.getDate(),inside:d.getMonth()===mi}})}

export function BookAppointmentModal({app}:{app:WelliApp}){
  const {state,actions,facilities,family}=app;
  const [memberId,setMemberId]=useState(state.activeFamilyId||"me");
  const [reason,setReason]=useState("");
  const [month,setMonth]=useState(()=>new Date());
  if(!state.showBookAppointment) return null;

  const ext=state.externalBookingFacility;
  const facility=ext?null:facilities.find(f=>f.id===state.bookingFacilityId);
  if(!ext&&!facility) return null;

  const name=ext?.name||facility?.name||"Demo Community Clinic";
  const address=ext?.address||(facility as any)?.address||"";
  const specialty=(facility as any)?.specialty||"Primary care";
  const days=useMemo(()=>daysFor(month),[month]);
  const patient=family.find(f=>f.id===memberId)||family[0];
  const disabled=!state.bookingDate||!state.bookingTimeSlot||!!state.bookingSubmitting;

  return <Modal visible={state.showBookAppointment} animationType="slide" transparent={false} onRequestClose={actions.closeBookAppointment}>
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{paddingHorizontal:16,paddingTop:8,paddingBottom:32}} showsVerticalScrollIndicator={false}>
        <View className="min-h-[44px] flex-row items-center justify-between"><TouchableOpacity onPress={actions.closeBookAppointment} className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"><Back/></TouchableOpacity><Text className="text-[12px] font-semibold text-slate-800">WelliRecord<Text className="text-[7px]">™</Text></Text><View className="h-9 w-9"/></View>

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">{name}</Text>
        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">Plan a demo visit</Text>
        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">Appointment request · date and time are illustrative until the facility confirms.</Text>

        <View className="mt-6 rounded-2xl bg-[#EEF3FA] p-4"><Text className="text-[14px] font-bold text-[#173B68]">{name}</Text><Text className="mt-1 text-[11.5px] leading-[17px] text-[#536A84]">{specialty}{address?` · ${address}`:""}</Text></View>

        {family.length>1?<View className="mt-5"><Text className="text-[12px] font-semibold text-[#173B68]">Visit for</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2"><View className="flex-row gap-2 pr-4">{family.map(m=>{const on=m.id===memberId;return <TouchableOpacity key={m.id} onPress={()=>setMemberId(m.id)} className={`rounded-full border px-4 py-3 ${on?"border-[#315B90] bg-[#EEF3FA]":"border-slate-200 bg-white"}`}><Text className={`text-[12px] font-semibold ${on?"text-[#173B68]":"text-slate-600"}`}>{m.id==="me"?"Myself":m.name.split(" ")[0]}</Text></TouchableOpacity>})}</View></ScrollView></View>:null}

        <View className="mt-6 rounded-2xl border border-slate-200 p-4">
          <View className="flex-row items-center justify-between"><TouchableOpacity onPress={()=>setMonth(x=>new Date(x.getFullYear(),x.getMonth()-1,1))} className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"><Text className="text-[20px] text-[#315B90]">‹</Text></TouchableOpacity><Text className="text-[15px] font-extrabold text-[#082F67]">{label(month)}</Text><TouchableOpacity onPress={()=>setMonth(x=>new Date(x.getFullYear(),x.getMonth()+1,1))} className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"><Text className="text-[20px] text-[#315B90]">›</Text></TouchableOpacity></View>
          <View className="mt-4 flex-row">{["S","M","T","W","T","F","S"].map((x,i)=><View key={`${x}${i}`} className="flex-1 items-center"><Text className="text-[10.5px] font-semibold text-slate-400">{x}</Text></View>)}</View>
          <View className="mt-2 flex-row flex-wrap">{days.map(d=>{const on=state.bookingDate===d.value;return <View key={d.value} style={{width:"14.2857%"}}><TouchableOpacity onPress={()=>{hapticFeedback.selection();actions.setBookingDate(d.value)}} className={`mx-auto my-1 h-9 w-9 items-center justify-center rounded-full ${on?"bg-[#082F67]":""}`}><Text className={`text-[12px] font-semibold ${on?"text-white":d.inside?"text-[#173B68]":"text-slate-300"}`}>{d.n}</Text></TouchableOpacity></View>})}</View>
        </View>

        <Text className="mt-6 text-[16px] font-extrabold text-[#082F67]">Time</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">{TIMES.map(slot=>{const on=state.bookingTimeSlot===slot;return <TouchableOpacity key={slot} onPress={()=>{hapticFeedback.selection();actions.setBookingTimeSlot(slot)}} className={`rounded-xl border px-4 py-3 ${on?"border-[#315B90] bg-[#EEF3FA]":"border-slate-200 bg-white"}`}><Text className={`text-[12px] font-semibold ${on?"text-[#173B68]":"text-slate-600"}`}>{slot}</Text></TouchableOpacity>})}</View>

        <Text className="mt-6 text-[12px] font-semibold text-[#173B68]">Note for the care team</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="What would you like to discuss?" placeholderTextColor="#94A3B8" multiline textAlignVertical="top" className="mt-2 min-h-[92px] rounded-2xl border border-slate-200 p-4 text-[14px] leading-[20px] text-slate-900"/>

        {patient?.insuranceProvider?<View className="mt-4 rounded-2xl border border-[#D7E2F1] bg-[#F3F6FB] p-4"><Text className="text-[13px] font-bold text-[#173B68]">Insurance on file</Text><Text className="mt-2 text-[11.5px] leading-[17px] text-[#536A84]">{patient.insuranceProvider}. Coverage is confirmed by the facility, not this screen.</Text></View>:null}

        <TouchableOpacity disabled={disabled} onPress={()=>{hapticFeedback.success();actions.confirmBooking({familyMemberId:memberId,reason})}} className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${disabled?"bg-slate-200":"bg-[#082F67]"}`}><Text className={`text-[14px] font-semibold ${disabled?"text-slate-400":"text-white"}`}>{state.bookingSubmitting?"Sending…":"Check demo booking"}</Text></TouchableOpacity>
        <TouchableOpacity onPress={actions.closeBookAppointment} className="mt-2 min-h-[44px] items-center justify-center"><Text className="text-[13px] font-semibold text-slate-500">Cancel</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </Modal>
}
