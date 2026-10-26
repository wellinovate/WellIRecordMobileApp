import { Linking, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SOCIAL_LINKS, SUPPORT_EMAIL } from '../data/contactLinks';

/** Email with Copy, then one row per public channel. Opens links in the phone's own app or browser. */
export function SupportContactCard({ toast }: { toast: (msg: string) => void }) {
  const open = (url: string) => {
    Linking.openURL(url).catch(() => toast('Unable to open that link'));
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      toast('Email address copied');
    } catch {
      toast('Could not copy. Long-press the address instead.');
    }
  };
  return (
    <View>
      <View className="mt-3 rounded-2xl bg-[#EEF3FA] p-4">
        <Text className="text-[15px] font-extrabold text-[#082F67]">Need help? We are here for you.</Text>
        <Text className="mt-1 text-[12px] text-slate-500">Write to our team. Do not include passwords or unnecessary clinical details.</Text>
        <View className="mt-3 flex-row items-center rounded-xl bg-white px-4 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-[11.5px] text-slate-500">Email address</Text>
            <Text selectable className="mt-0.5 text-[14px] font-bold text-[#173B68]">{SUPPORT_EMAIL}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Copy email address" activeOpacity={0.8} onPress={copy} className="rounded-full border border-[#8ED8BF] bg-[#E8F8F2] px-4 py-2">
            <Text className="text-[12.5px] font-semibold text-[#0F7A5A]">Copy</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => open(`mailto:${SUPPORT_EMAIL}`)} className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-[#082F67]">
          <Text className="text-[13.5px] font-semibold text-white">Email us</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-3 rounded-2xl bg-[#EEF3FA] p-2">
        {SOCIAL_LINKS.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            accessibilityRole="link"
            accessibilityLabel={`Open WelliRecord on ${s.label}`}
            activeOpacity={0.8}
            onPress={() => open(s.url)}
            className={`flex-row items-center rounded-xl bg-white px-3 py-3 ${i ? 'mt-2' : ''}`}
          >
            <View style={{ backgroundColor: s.color }} className="h-8 w-8 items-center justify-center rounded-lg">
              <Text className="text-[11px] font-extrabold text-white">{s.badge}</Text>
            </View>
            <Text className="ml-3 flex-1 text-[14px] font-semibold text-[#173B68]">{s.label}</Text>
            <Text className="text-[16px] text-slate-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
