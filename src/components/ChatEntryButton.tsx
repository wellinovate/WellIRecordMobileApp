import { Text, TouchableOpacity } from "react-native";

import type { WelliApp } from "../state/useWelliApp";

type ChatEntryButtonProps = {
  app: WelliApp;
};

export default function ChatEntryButton({
  app,
}: ChatEntryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Help & WelliRecord Assistant"
      onPress={() => app.actions.setTab("chat")}
      className="items-center justify-center rounded-[18px] bg-[#00AA77] px-[12px] py-[6px]"
    >
      <Text className="text-[13px] font-semibold text-white">
        Help
      </Text>
    </TouchableOpacity>
  );
}

export { ChatEntryButton };
