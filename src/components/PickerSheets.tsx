import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from './ActivityModal';
import { formatClock, formatYmd, MONTHS, pad, todayYmd, toYmd } from '../utils/dateFormat';

const ACCENT = '#315B90';
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.sheetTitle}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Month calendar. `value`, `min` and `max` are YYYY-MM-DD. */
export function DatePickerSheet({ visible, title, value, min, max, allowClear, onPick, onClose }: {
  visible: boolean; title: string; value: string; min?: string; max?: string; allowClear?: boolean;
  onPick: (ymd: string) => void; onClose: () => void;
}) {
  const seed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayYmd();
  const [year, setYear] = useState(Number(seed.slice(0, 4)));
  const [month, setMonth] = useState(Number(seed.slice(5, 7)) - 1);
  useEffect(() => {
    if (visible) { setYear(Number(seed.slice(0, 4))); setMonth(Number(seed.slice(5, 7)) - 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const step = (dm: number) => {
    const d = new Date(year, month + dm, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={s.monthRow}>
        <TouchableOpacity accessibilityLabel="Previous year" onPress={() => setYear(year - 1)} style={s.nav}><Text style={s.navText}>«</Text></TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Previous month" onPress={() => step(-1)} style={s.nav}><Text style={s.navText}>‹</Text></TouchableOpacity>
        <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity accessibilityLabel="Next month" onPress={() => step(1)} style={s.nav}><Text style={s.navText}>›</Text></TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Next year" onPress={() => setYear(year + 1)} style={s.nav}><Text style={s.navText}>»</Text></TouchableOpacity>
      </View>
      <View style={s.weekRow}>{DAYS.map((d, i) => <Text key={i} style={s.weekDay}>{d}</Text>)}</View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`b${i}`} style={s.cell} />;
          const ymd = toYmd(year, month, d);
          const off = (min && ymd < min) || (max && ymd > max);
          const sel = ymd === value;
          return (
            <TouchableOpacity key={ymd} disabled={Boolean(off)} accessibilityLabel={formatYmd(ymd)} onPress={() => { onPick(ymd); onClose(); }} style={s.cell}>
              <View style={[s.day, sel && { backgroundColor: ACCENT }]}>
                <Text style={[s.dayText, sel && { color: '#fff', fontWeight: '800' }, off && { color: '#C5CCD6' }]}>{d}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.actions}>
        {allowClear && value ? (
          <TouchableOpacity onPress={() => { onPick(''); onClose(); }} style={s.ghost}><Text style={s.ghostText}>Clear date</Text></TouchableOpacity>
        ) : <View />}
        <TouchableOpacity onPress={onClose} style={s.ghost}><Text style={[s.ghostText, { color: '#6B7280' }]}>Cancel</Text></TouchableOpacity>
      </View>
    </Sheet>
  );
}

/** Clock picker. Value is HH:mm in 24 hours. */
export function TimePickerSheet({ visible, title, value, onPick, onClose }: {
  visible: boolean; title: string; value: string; onPick: (hhmm: string) => void; onClose: () => void;
}) {
  const parse = (v: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    const h = m ? Number(m[1]) : 8;
    return { h12: h % 12 === 0 ? 12 : h % 12, min: m ? Math.round(Number(m[2]) / 5) * 5 % 60 : 0, pm: h >= 12 };
  };
  const [h12, setH12] = useState(8);
  const [min, setMin] = useState(0);
  const [pm, setPm] = useState(false);
  useEffect(() => {
    if (visible) { const p = parse(value); setH12(p.h12); setMin(p.min); setPm(p.pm); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const chip = (label: string, on: boolean, press: () => void, key: string) => (
    <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={press} style={[s.chip, on && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
  const h24 = (h12 % 12) + (pm ? 12 : 0);
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={s.preview}>{formatClock(`${pad(h24)}:${pad(min)}`)}</Text>
      <Text style={s.label}>Hour</Text>
      <View style={s.chips}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => chip(String(h), h === h12, () => setH12(h), `h${h}`))}</View>
      <Text style={s.label}>Minute</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.chips}>{Array.from({ length: 12 }, (_, i) => i * 5).map((m) => chip(pad(m), m === min, () => setMin(m), `m${m}`))}</View>
      </ScrollView>
      <View style={[s.chips, { marginTop: 8 }]}>
        {chip('AM', !pm, () => setPm(false), 'am')}
        {chip('PM', pm, () => setPm(true), 'pm')}
      </View>
      <View style={s.actions}>
        <TouchableOpacity onPress={onClose} style={s.ghost}><Text style={[s.ghostText, { color: '#6B7280' }]}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => { onPick(`${pad(h24)}:${pad(min)}`); onClose(); }} style={s.done}><Text style={s.doneText}>Set time</Text></TouchableOpacity>
      </View>
    </Sheet>
  );
}

/** Bottom sheet list for a dropdown. With `search`, a box filters the list. */
export function ChoiceSheet({ visible, title, options, value, onPick, onClose }: {
  visible: boolean; title: string; options: { id: string; label: string }[]; value: string;
  onPick: (id: string) => void; onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={{ maxHeight: 360 }}>
        {options.map((o) => {
          const on = o.id === value;
          return (
            <TouchableOpacity key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { onPick(o.id); onClose(); }} style={s.choice}>
              <Text style={[s.choiceText, on && { color: ACCENT, fontWeight: '800' }]}>{o.label}</Text>
              {on ? <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '800' }}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,24,48,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D9E0E9', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#082F67', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  nav: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 22, color: ACCENT, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: '#6B7280', fontWeight: '700', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15, color: '#111827' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  ghost: { paddingVertical: 12, paddingHorizontal: 8 },
  ghostText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  done: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  preview: { fontSize: 32, fontWeight: '800', color: '#082F67', textAlign: 'center', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, minWidth: 48, alignItems: 'center' },
  choice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  choiceText: { fontSize: 16, color: '#111827' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#111827' },
});
