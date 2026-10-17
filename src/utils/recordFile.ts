import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { CONFIG } from '../services/config';
import { getAuthToken } from '../services/apiClient';
import type { HealthRecord } from '../data/types';

type Attachment = NonNullable<HealthRecord['attachments']>[number];

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

function extensionOf(att: Attachment): string {
  const source = `${att.name || ''} ${att.url || ''}`.toLowerCase();
  const match = source.match(/\.(pdf|png|jpe?g)(?:[?\s]|$)/);
  if (match) return match[1];
  if (/pdf/.test(att.fileType || '')) return 'pdf';
  if (/png/.test(att.fileType || '')) return 'png';
  if (/jp/.test(att.fileType || '')) return 'jpg';
  return 'pdf';
}

async function downloadAttachment(att: Attachment): Promise<{ uri: string; ext: string }> {
  const ext = extensionOf(att);
  const token = getAuthToken();
  const proxied = `${CONFIG.apiBaseUrl}/lab-documents/proxy?url=${encodeURIComponent(att.url)}`;
  const file = await File.downloadFileAsync(proxied, new File(Paths.cache, `record_${Date.now()}.${ext}`), {
    idempotent: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { uri: file.uri, ext };
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function recordSummaryText(record: HealthRecord, patientName: string): string {
  const lines = [
    `${record.title}`,
    `Patient: ${patientName}`,
    `Provider: ${record.provider}`,
    `Date: ${record.date}`,
  ];
  if (record.summary) lines.push('', record.summary);
  const values = record.extractedOcr?.keyValues ?? [];
  if (values.length) lines.push('', ...values.map((kv) => `${kv.label}: ${kv.value}`));
  lines.push('', 'Shared from WelliRecord. Check the original with the issuing facility.');
  return lines.join('\n');
}

function recordSummaryHtml(record: HealthRecord, patientName: string): string {
  const rows = (record.extractedOcr?.keyValues ?? [])
    .map((kv) => `<tr><td>${escapeHtml(kv.label)}</td><td>${escapeHtml(kv.value)}</td></tr>`)
    .join('');
  return `<html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;padding:32px;color:#0f172a}
    h1{font-size:22px;margin:0 0 4px} .meta{color:#475569;font-size:13px;margin:2px 0}
    table{border-collapse:collapse;margin-top:16px;width:100%} td{border-bottom:1px solid #e2e8f0;padding:8px 4px;font-size:14px}
    .note{margin-top:24px;color:#64748b;font-size:12px}
  </style></head><body>
    <h1>${escapeHtml(record.title)}</h1>
    <p class="meta">Patient: ${escapeHtml(patientName)}</p>
    <p class="meta">Provider: ${escapeHtml(record.provider)}</p>
    <p class="meta">Date: ${escapeHtml(record.date)}</p>
    ${record.summary ? `<p style="margin-top:16px">${escapeHtml(record.summary).replace(/\n/g, '<br/>')}</p>` : ''}
    ${rows ? `<table>${rows}</table>` : ''}
    <p class="note">Printed from WelliRecord. Check the original with the issuing facility.</p>
  </body></html>`;
}

/**
 * Opens the system share sheet with the record's file (or a text summary when
 * there is no file). The person picks the app, for example WhatsApp or Files.
 */
export async function shareRecord(record: HealthRecord, patientName: string): Promise<void> {
  const att = record.attachments?.[0];
  if (att?.url) {
    const { uri, ext } = await downloadAttachment(att);
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(uri, {
      mimeType: MIME[ext] || 'application/octet-stream',
      UTI: ext === 'pdf' ? 'com.adobe.pdf' : undefined,
      dialogTitle: record.title,
    });
    return;
  }
  await Share.share({ message: recordSummaryText(record, patientName), title: record.title });
}

/** Prints the record's PDF, or a one-page summary when there is no PDF. */
export async function printRecord(record: HealthRecord, patientName: string): Promise<void> {
  const att = record.attachments?.[0];
  if (att?.url && extensionOf(att) === 'pdf') {
    const { uri } = await downloadAttachment(att);
    await Print.printAsync({ uri });
    return;
  }
  await Print.printAsync({ html: recordSummaryHtml(record, patientName) });
}
