import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';

export function PdfViewerModal({
  visible,
  url,
  title,
  onClose,
}: {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
}) {
  if (!url) return null;

  // Google Docs viewer wraps the PDF for reliable rendering across
  // Android/iOS WebView engines, rather than relying on native PDF
  // support that varies by platform.
  const inlineUrl = url.includes("/upload/")
    ? url.replace("/upload/", "/upload/fl_attachment:false/")
    : url;
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(inlineUrl)}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title || 'Document'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6l-12 12" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <WebView source={{ uri: viewerUrl }} style={{ flex: 1 }} startInLoadingState />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  closeBtn: { padding: 4 },
});
