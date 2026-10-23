import { CONFIG } from '../services/config';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { getAuthToken } from '../services/apiClient';
import Svg, { Path } from 'react-native-svg';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
};
const EXT_BY_MIME: Record<string, string> = Object.fromEntries(Object.entries(MIME_BY_EXT).map(([e, m]) => [m, e]));

export function PdfViewerModal({
  visible,
  url,
  title,
  fileName,
  fileType,
  onClose,
}: {
  visible: boolean;
  url: string | null;
  title?: string;
  /** Name and type of a file the patient attached. Their own files are fetched straight from our server. */
  fileName?: string;
  fileType?: string;
  onClose: () => void;
}) {
  const own = Boolean(url && url.startsWith('/records/files/'));
  const ext = (fileName?.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? EXT_BY_MIME[fileType ?? ''] ?? 'pdf');
  const mime = fileType && fileType !== 'application/octet-stream' ? fileType : MIME_BY_EXT[ext] ?? 'application/pdf';
  const [error, setError] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState(false);

  const token = getAuthToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const proxiedUrl = url
    ? own
      ? `${CONFIG.apiBaseUrl}${url}`
      : `${CONFIG.apiBaseUrl}/lab-documents/proxy?url=${encodeURIComponent(url)}`
    : null;

  // Android WebView cannot render PDFs, and routing the file through a third
  // party viewer would send patient documents to that third party. Download
  // to app cache and hand it to the user's own PDF app instead.
  const openExternally = React.useCallback(async () => {
    if (!proxiedUrl) return;
    setOpening(true);
    setError(null);
    try {
      const file = await File.downloadFileAsync(proxiedUrl, new File(Paths.cache, `doc_${Date.now()}.${ext}`), {
        idempotent: true,
        headers: authHeaders,
      });
      if (!(await Sharing.isAvailableAsync())) {
        setError('No app is available to open this document.');
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: ext === 'pdf' ? 'com.adobe.pdf' : undefined, dialogTitle: title || 'Document' });
    } catch {
      setError('Could not open this document. Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  }, [proxiedUrl, title, ext, mime]);

  if (!url || !proxiedUrl) return null;

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
        {Platform.OS === 'ios' ? (
          <WebView source={{ uri: proxiedUrl, headers: authHeaders }} style={{ flex: 1 }} startInLoadingState />
        ) : (
          <View style={styles.center}>
            <Text style={styles.message}>{error || 'Open this document in an app on your phone.'}</Text>
            <TouchableOpacity onPress={openExternally} disabled={opening} style={styles.openBtn}>
              {opening ? <ActivityIndicator color="#fff" /> : <Text style={styles.openText}>{error ? 'Try again' : 'Open document'}</Text>}
            </TouchableOpacity>
          </View>
        )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 15, color: '#334155', textAlign: 'center', marginBottom: 16 },
  openBtn: { backgroundColor: '#041E42', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, minWidth: 160, alignItems: 'center' },
  openText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
