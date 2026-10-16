import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Track } from 'livekit-client';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/react-native';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

function Controls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal && isTrackReference(t));
  const localTrack = tracks.find((t) => t.participant.isLocal && isTrackReference(t));

  return (
    <View style={styles.fill}>
      <View style={styles.fill}>
        {remoteTrack && isTrackReference(remoteTrack) ? (
          <VideoTrack trackRef={remoteTrack} style={styles.fill} objectFit="cover" />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.waitingText}>
              {remotes.length === 0 ? 'Waiting for your clinician to join…' : 'Your clinician has camera off'}
            </Text>
          </View>
        )}
        {localTrack && isTrackReference(localTrack) && isCameraEnabled ? (
          <View style={styles.pip}>
            <VideoTrack trackRef={localTrack} style={styles.fill} objectFit="cover" mirror />
          </View>
        ) : null}
      </View>
      <View style={styles.bar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          style={[styles.btn, !isMicrophoneEnabled && styles.btnOff]}
        >
          <Text style={styles.btnText}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          style={[styles.btn, !isCameraEnabled && styles.btnOff]}
        >
          <Text style={styles.btnText}>{isCameraEnabled ? 'Camera off' : 'Camera on'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Leave visit" onPress={onLeave} style={[styles.btn, styles.leave]}>
          <Text style={styles.btnText}>Leave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function InCallModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [connected, setConnected] = useState(false);
  const session = state.telehealthSession;

  useEffect(() => {
    if (!state.inCall) return;
    AudioSession.startAudioSession().catch(() => {});
    return () => {
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [state.inCall]);

  if (!state.inCall || !session) return null;

  const leave = () => {
    hapticFeedback.light();
    setConnected(false);
    actions.endCall();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={leave}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{session.facilityName || 'Video visit'}</Text>
          <Text style={styles.sub}>{connected ? 'Connected' : 'Connecting…'}</Text>
        </View>
        <LiveKitRoom
          serverUrl={session.url}
          token={session.token}
          connect
          audio
          video
          onConnected={() => setConnected(true)}
          onDisconnected={() => {
            setConnected(false);
            actions.endCall();
          }}
          onError={() => actions.reportCallError('The video connection failed. Try joining again.')}
        >
          {!connected ? <ActivityIndicator style={styles.spinner} color="#fff" /> : null}
          <Controls onLeave={leave} />
        </LiveKitRoom>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  spinner: { position: 'absolute', top: 120, alignSelf: 'center' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  waitingText: { color: '#cbd5e1', fontSize: 14, textAlign: 'center' },
  pip: { position: 'absolute', right: 12, top: 12, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1e293b' },
  bar: { flexDirection: 'row', justifyContent: 'center', gap: 10, padding: 16 },
  btn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: '#475569' },
  leave: { backgroundColor: '#b91c1c' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
