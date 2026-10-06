import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { TrendChart, type TrendLine } from '../components/TrendChart';
import { useTheme } from '../theme/ThemeContext';
import { pointsFromLogs, type VitalPoint } from '../utils/vitalsSeries';
import type { WelliApp } from '../state/useWelliApp';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];
const DAY = 24 * 60 * 60 * 1000;

interface Metric {
  key: string;
  title: string;
  unit: string;
  lines: { name: string; color: string; pick: (p: VitalPoint) => number | undefined }[];
}

const METRICS: Metric[] = [
  {
    key: 'bp',
    title: 'Blood pressure',
    unit: 'mmHg',
    lines: [
      { name: 'Systolic', color: '#0EA5E9', pick: (p) => p.sys },
      { name: 'Diastolic', color: '#7c3aed', pick: (p) => p.dia },
    ],
  },
  { key: 'hr', title: 'Heart rate', unit: 'bpm', lines: [{ name: 'Heart rate', color: '#e11d48', pick: (p) => p.hr }] },
  { key: 'glucose', title: 'Glucose', unit: 'mg/dL', lines: [{ name: 'Glucose', color: '#d97706', pick: (p) => p.glucose }] },
  { key: 'spo2', title: 'Oxygen saturation', unit: '%', lines: [{ name: 'SpO2', color: '#0d9488', pick: (p) => p.spo2 }] },
  { key: 'temp', title: 'Temperature', unit: '°C', lines: [{ name: 'Temperature', color: '#ea580c', pick: (p) => p.temp }] },
];

export function VitalsTrendsModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const { width } = useWindowDimensions();
  const [days, setDays] = useState(30);

  const points = useMemo(
    () => [...(state.vitalsSeries || []), ...pointsFromLogs(state.vitalsLogs || [])],
    [state.vitalsSeries, state.vitalsLogs]
  );

  if (!state.showVitalsTrends) return null;

  const to = Date.now();
  const from = to - days * DAY;
  const chartWidth = width - 32 - 28;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={actions.closeVitalsTrends}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Vitals trends" onClose={actions.closeVitalsTrends} />
        <View style={styles.ranges}>
          {RANGES.map((r) => {
            const active = r.days === days;
            return (
              <TouchableOpacity
                key={r.days}
                onPress={() => setDays(r.days)}
                accessibilityRole="button"
                style={[
                  styles.rangeChip,
                  { backgroundColor: active ? '#0EA5E9' : theme.surface, borderColor: active ? '#0EA5E9' : theme.border },
                ]}
              >
                <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '600', fontSize: 13 }}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {points.length === 0 && (
            <Text style={[styles.note, { color: theme.muted }]}>
              No vitals yet. Readings recorded by your providers or logged here will be charted.
            </Text>
          )}
          {METRICS.map((m) => {
            const lines: TrendLine[] = m.lines.map((l) => ({
              color: l.color,
              points: points
                .filter((p) => p.t >= from && p.t <= to && l.pick(p) !== undefined)
                .map((p) => ({ t: p.t, y: l.pick(p) as number })),
            }));
            const flat = lines.flatMap((l) => l.points);
            if (points.length > 0 && flat.length === 0 && !points.some((p) => m.lines.some((l) => l.pick(p) !== undefined))) {
              return null; // never recorded: don't show an empty chart
            }
            if (points.length === 0) return null;
            const primary = [...lines[0].points].sort((a, b) => b.t - a.t)[0];
            const secondary = lines[1] ? [...lines[1].points].sort((a, b) => b.t - a.t)[0] : undefined;
            const ys = lines[0].points.map((p) => p.y);
            return (
              <View key={m.key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{m.title}</Text>
                  {primary && (
                    <Text style={[styles.latest, { color: theme.text }]}>
                      {primary.y}
                      {secondary ? `/${secondary.y}` : ''} <Text style={{ color: theme.muted, fontSize: 12 }}>{m.unit}</Text>
                    </Text>
                  )}
                </View>
                <TrendChart
                  lines={lines}
                  from={from}
                  to={to}
                  unit={m.unit}
                  width={chartWidth}
                  textColor={theme.muted}
                  gridColor={theme.border}
                />
                <View style={styles.legend}>
                  {m.lines.length > 1 &&
                    m.lines.map((l) => (
                      <View key={l.name} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                        <Text style={{ color: theme.muted, fontSize: 12 }}>{l.name}</Text>
                      </View>
                    ))}
                  {ys.length > 0 && (
                    <Text style={{ color: theme.muted, fontSize: 12, marginLeft: 'auto' }}>
                      {ys.length} reading{ys.length === 1 ? '' : 's'} · {Math.min(...ys)}–{Math.max(...ys)}
                      {m.lines.length > 1 ? ' (systolic)' : ''}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ranges: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  rangeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  content: { padding: 16, gap: 12 },
  note: { fontSize: 14, textAlign: 'center', marginTop: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  latest: { fontSize: 16, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
