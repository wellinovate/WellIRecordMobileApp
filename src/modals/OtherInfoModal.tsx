import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ACCENT, h, HealthEntryShell } from '../components/HealthEntryShell';
import { formatYmd } from '../utils/dateFormat';
import { selfReportedService, type LatestMeasurement, type MeasurementKind } from '../services/selfReportedService';
import type { WelliApp } from '../state/useWelliApp';

interface Field { kind: MeasurementKind; label: string; placeholder: string; hint: string; units: string[] }

const FIELDS: Field[] = [
  { kind: 'blood_sugar', label: 'Blood sugar', placeholder: 'Enter fasting blood sugar', hint: 'Enter a fasting or after-meal reading for accuracy.', units: ['mg/dL', 'mmol/L'] },
  { kind: 'ldl_cholesterol', label: 'LDL cholesterol', placeholder: 'Enter LDL cholesterol', hint: 'Use a lab result if you have one.', units: ['mg/dL', 'mmol/L'] },
  { kind: 'waist', label: 'Waist circumference', placeholder: 'Enter waist size', hint: 'Keep the tape snug but not tight.', units: ['cm', 'in'] },
  { kind: 'uric_acid', label: 'Uric acid', placeholder: 'Enter uric acid', hint: 'Leave blank if you have no result.', units: ['mg/dL', 'umol/L'] },
  { kind: 'thyroid_tsh', label: 'Thyroid (TSH)', placeholder: 'Enter TSH', hint: 'Leave blank if you have no result.', units: ['mIU/L'] },
];
const CONTEXTS = [{ id: 'fasting', label: 'Fasting' }, { id: 'after_meal', label: 'After a meal' }];
const CONTEXT_LABEL: Record<string, string> = { fasting: 'fasting', after_meal: 'after a meal', random: 'random' };
const messageOf = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

/**
 * Profile > Health information > Other info. Optional self-entered measurements. The app stores what the
 * person types and shows it back. It does not say whether a number is high or low.
 * Always mounted; every hook runs before the early return.
 */
export function OtherInfoModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const open = state.healthEntry === 'measurements';
  const ownerId = state.activeFamilyId || 'me';
  const [values, setValues] = useState<Record<string, string>>({});
  const [unitOf, setUnitOf] = useState<Record<string, string>>({});
  const [context, setContext] = useState<string>('');
  const [latest, setLatest] = useState<Partial<Record<MeasurementKind, LatestMeasurement>>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ kind: string; message: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await selfReportedService.loadMeasurements(ownerId); setLatest(r.latest || {}); }
    catch (e) { setError(messageOf(e, 'Could not load your saved values. Check your connection.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setValues({}); setUnitOf({}); setContext(''); setError(null); setFieldError(null); setDone(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  if (!open) return null;

  const close = () => actions.closeHealthEntry();

  const save = async () => {
    if (busy) return;
    const rows = FIELDS.filter((f) => (values[f.kind] ?? '').trim() !== '').map((f) => ({
      kind: f.kind,
      value: values[f.kind].trim(),
      unit: unitOf[f.kind] || f.units[0],
      ...(f.kind === 'blood_sugar' && context ? { context } : {}),
    }));
    setError(null); setFieldError(null); setDone(null);
    if (!rows.length) { setError('Enter at least one value, or go back.'); return; }
    setBusy(true);
    try {
      await selfReportedService.saveMeasurements(ownerId, rows);
      setValues({}); setContext('');
      setDone(rows.length === 1 ? 'Saved.' : `Saved ${rows.length} values.`);
      load();
    } catch (e) {
      const data = (e as { data?: { kind?: string } }).data;
      if (data?.kind) setFieldError({ kind: data.kind, message: messageOf(e, 'Check this value.') });
      else setError(messageOf(e, 'Could not save. Try again.'));
    } finally { setBusy(false); }
  };

  const lastLine = (f: Field) => {
    const l = latest[f.kind];
    if (!l) return null;
    const when = l.measuredAt ? formatYmd(String(l.measuredAt).slice(0, 10)) : '';
    const ctx = f.kind === 'blood_sugar' && l.context ? `, ${CONTEXT_LABEL[l.context] ?? l.context}` : '';
    return `Last saved: ${l.value} ${l.unit}${ctx}${when ? ` · ${when}` : ''}`;
  };

  return (
    <HealthEntryShell
      title="Other info"
      onClose={close}
      footer={
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={[h.primary, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={h.primaryText}>Save</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={h.intro}>
        All of these are optional. Fill in only what you have. The app keeps what you enter and does not tell you whether a value is high or low. Ask your clinic what a result means.
      </Text>
      {loading ? <ActivityIndicator color={ACCENT} /> : null}
      {FIELDS.map((f) => {
        const unit = unitOf[f.kind] || f.units[0];
        return (
          <View key={f.kind}>
            <Text style={h.label}>{f.label}</Text>
            <View style={h.row}>
              <TextInput
                value={values[f.kind] ?? ''}
                onChangeText={(v) => setValues((p) => ({ ...p, [f.kind]: v.replace(/[^0-9.,]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder={f.placeholder}
                placeholderTextColor="#9AA3AF"
                accessibilityLabel={f.label}
                style={[h.input, { flex: 1 }]}
              />
              {f.units.length > 1 ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {f.units.map((u) => (
                    <TouchableOpacity key={u} accessibilityRole="button" accessibilityState={{ selected: unit === u }} onPress={() => setUnitOf((p) => ({ ...p, [f.kind]: u }))}
                      style={[h.chip, unit === u && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                      <Text style={[h.chipText, unit === u && { color: '#fff' }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : <Text style={h.chipText}>{f.units[0]}</Text>}
            </View>
            {f.kind === 'blood_sugar' ? (
              <View style={h.chips}>
                {CONTEXTS.map((c) => (
                  <TouchableOpacity key={c.id} accessibilityRole="button" accessibilityState={{ selected: context === c.id }} onPress={() => setContext(context === c.id ? '' : c.id)}
                    style={[h.chip, context === c.id && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                    <Text style={[h.chipText, context === c.id && { color: '#fff' }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <Text style={h.hint}>{f.hint}</Text>
            {lastLine(f) ? <Text style={h.last}>{lastLine(f)}</Text> : null}
            {fieldError?.kind === f.kind ? <Text style={h.err} accessibilityLiveRegion="polite">{fieldError.message}</Text> : null}
          </View>
        );
      })}
      {error ? <Text style={h.err} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={h.ok} accessibilityLiveRegion="polite">{done}</Text> : null}
    </HealthEntryShell>
  );
}
