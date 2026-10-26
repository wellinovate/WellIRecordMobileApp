import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WheelPickerSheet } from './WheelPickerSheet';
import { allergyStatus, NO_KNOWN_ALLERGIES } from '../utils/allergyStatus';
import {
  cmToIn, formatMeasure, HEIGHT_RANGE, inToCm, kgToLbs, lbsToKg, parseHeight, parseWeight, WEIGHT_RANGE,
  type HeightUnit, type WeightUnit,
} from '../utils/vitals';

const ACCENT = '#315B90';

/** Tap to open the wheel. Shows "169 cm" or a placeholder. Text it cannot read is shown as it is and replaced on the next pick. */
export function VitalField({ kind, value, onChange }: { kind: 'height' | 'weight'; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const isHeight = kind === 'height';
  const parsed = isHeight ? parseHeight(value) : parseWeight(value);
  const units = isHeight ? ['cm', 'in'] : ['kg', 'lbs'];
  const startUnit = parsed?.unit ?? units[0];
  const startValue = parsed?.value ?? (isHeight ? 170 : 70);

  return (
    <>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={isHeight ? 'Choose height' : 'Choose weight'} onPress={() => setOpen(true)} style={s.select}>
        <Text style={value ? s.selectText : s.placeholder}>{value || (isHeight ? 'Specify your height' : 'Specify your weight')}</Text>
        <Text style={{ color: '#6B7280' }}>▾</Text>
      </TouchableOpacity>
      <WheelPickerSheet
        visible={open}
        title={isHeight ? 'Specify your height' : 'Specify your weight'}
        units={units}
        unit={startUnit}
        value={startValue}
        range={(u) => (isHeight ? HEIGHT_RANGE[u as HeightUnit] : WEIGHT_RANGE[u as WeightUnit])}
        convert={(v, from, to) =>
          isHeight ? (from === 'cm' && to === 'in' ? cmToIn(v) : inToCm(v)) : from === 'kg' && to === 'lbs' ? kgToLbs(v) : lbsToKg(v)
        }
        onConfirm={(v, u) => onChange(formatMeasure({ value: v, unit: u }))}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Yes or No before the details. Neither button is chosen until the person answers: an empty or "None on file"
 * entry means not recorded, which is different from "no known allergies".
 */
export function YesNoField({ kind, value, onChange }: { kind: 'allergies' | 'conditions'; value: string; onChange: (v: string) => void }) {
  const status = allergyStatus(value);
  const [yes, setYes] = useState<boolean | null>(status === 'recorded' ? true : status === 'none' ? false : null);
  const noun = kind === 'allergies' ? 'allergies' : 'chronic conditions';
  const noText = kind === 'allergies' ? NO_KNOWN_ALLERGIES : 'None';

  const pick = (answer: boolean) => {
    setYes(answer);
    if (answer) { if (allergyStatus(value) !== 'recorded') onChange(''); }
    else onChange(noText);
  };

  const btn = (on: boolean, label: string, answer: boolean) => (
    <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => pick(answer)} style={[s.yn, on && s.ynOn]}>
      <Text style={[s.ynText, on && { color: ACCENT, fontWeight: '800' }]}>{label}</Text>
      <View style={[s.dot, on && { backgroundColor: ACCENT, borderColor: ACCENT }]}>{on ? <Text style={s.tick}>✓</Text> : null}</View>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text style={s.q}>{kind === 'allergies' ? 'Do you have any allergies?' : 'Do you have any chronic conditions?'}</Text>
      <View style={s.ynRow}>
        {btn(yes === true, 'Yes, I do have some', true)}
        {btn(yes === false, "I don't have any", false)}
      </View>
      {yes === null ? <Text style={s.hint}>Not answered. It stays "not recorded" until you choose.</Text> : null}
      {yes === true ? (
        <TextInput
          value={status === 'recorded' ? value : ''}
          onChangeText={onChange}
          placeholder={kind === 'allergies' ? 'e.g. Penicillin, Peanuts' : 'e.g. Hypertension, Asthma'}
          placeholderTextColor="#94a3b8"
          accessibilityLabel={`List your ${noun}`}
          style={s.input}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  select: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  selectText: { fontSize: 16, color: '#111827' },
  placeholder: { fontSize: 16, color: '#94a3b8' },
  q: { fontSize: 14, color: '#374151', marginBottom: 8 },
  ynRow: { flexDirection: 'row', gap: 10 },
  yn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#fff' },
  ynOn: { borderColor: ACCENT, backgroundColor: 'rgba(49,91,144,0.06)' },
  ynText: { flex: 1, fontSize: 14, color: '#374151', paddingRight: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#B8C2CF', alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#D9E0E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', marginTop: 10, backgroundColor: '#fff' },
});
