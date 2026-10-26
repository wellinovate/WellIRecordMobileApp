import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Modal } from './ActivityModal';

const ACCENT = '#315B90';
const ITEM_H = 52;
const VISIBLE = 5;

interface Props {
  visible: boolean;
  title: string;
  units: string[];
  unit: string;
  value: number;
  range: (unit: string) => { min: number; max: number };
  convert: (value: number, from: string, to: string) => number;
  onConfirm: (value: number, unit: string) => void;
  onClose: () => void;
}

/** Bottom sheet with a unit switch and a snapping number wheel. Used for height and weight. */
export function WheelPickerSheet({ visible, title, units, unit: unitIn, value: valueIn, range, convert, onConfirm, onClose }: Props) {
  const [unit, setUnit] = useState(unitIn);
  const [sel, setSel] = useState(valueIn);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) { setUnit(unitIn); setSel(valueIn); }
  }, [visible, unitIn, valueIn]);

  const { min, max } = range(unit);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const start = clamp(sel);

  // Jump the wheel to the selected number when the sheet opens or the unit changes.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => scroller.current?.scrollTo({ y: (clamp(sel) - min) * ITEM_H, animated: false }), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, unit]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const v = clamp(min + idx);
    if (v !== sel) setSel(v);
  };

  const switchUnit = (u: string) => {
    if (u === unit) return;
    const next = convert(clamp(sel), unit, u);
    const r = range(u);
    setUnit(u);
    setSel(Math.min(r.max, Math.max(r.min, next)));
  };

  const pad = ITEM_H * Math.floor(VISIBLE / 2);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.titleRow}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={s.x}><Text style={{ fontSize: 16, color: '#173B68' }}>✕</Text></TouchableOpacity>
          </View>
          <View style={s.seg}>
            {units.map((u) => (
              <TouchableOpacity key={u} accessibilityRole="button" accessibilityState={{ selected: u === unit }} onPress={() => switchUnit(u)} style={[s.segItem, u === unit && s.segOn]}>
                <Text style={[s.segText, u === unit && { color: '#111827', fontWeight: '800' }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: ITEM_H * VISIBLE, marginTop: 8 }}>
            <View pointerEvents="none" style={s.window} />
            <ScrollView
              key={unit}
              ref={scroller}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              contentOffset={{ x: 0, y: (start - min) * ITEM_H }}
              contentContainerStyle={{ paddingVertical: pad }}
              accessibilityLabel={`${title} wheel`}
            >
              {numbers.map((n) => {
                const d = Math.abs(n - sel);
                return (
                  <View key={n} style={s.item}>
                    <Text style={[s.num, d === 0 ? s.numOn : d === 1 ? s.numNear : s.numFar]}>{n}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => { onConfirm(clamp(sel), unit); onClose(); }} style={s.ok}>
            <Text style={s.okText}>Okay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,24,48,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#082F67' },
  x: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', backgroundColor: '#F1F4F8', borderRadius: 14, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11 },
  segOn: { backgroundColor: '#fff' },
  segText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  window: { position: 'absolute', left: 40, right: 40, top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H, borderWidth: 2, borderColor: ACCENT, borderRadius: 14, backgroundColor: 'rgba(49,91,144,0.05)' },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 30, color: '#111827' },
  numOn: { fontSize: 38, fontWeight: '800', color: ACCENT },
  numNear: { color: '#111827' },
  numFar: { color: '#B8C0CC' },
  ok: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  okText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
