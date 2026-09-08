import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import ChatScreen from '../screens/ChatScreen';

// Drop this into the tab bar area or a header, wherever the app's existing
// action buttons live. Not a floating widget — matches native modal patterns.
export default function ChatEntryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel="Help & WelliRecord Assistant"
      >
        <Text style={styles.buttonText}>Help</Text>
      </TouchableOpacity>
      <ChatScreen visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { ChatEntryButton };

const styles = StyleSheet.create({
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#0a7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
