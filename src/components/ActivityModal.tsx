import { Modal as RNModal, View, type ModalProps } from 'react-native';
import { markActivity } from '../utils/inactivityCore';

// A React Native Modal draws in its own window, so touches inside it never reach the app's root view.
// This wrapper reports every touch start to the inactivity timer, then lets the touch carry on as usual.
export function Modal({ children, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      <View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { markActivity(); return false; }}>
        {children}
      </View>
    </RNModal>
  );
}
