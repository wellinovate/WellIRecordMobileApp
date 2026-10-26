import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ACCENT, h, HealthEntryShell } from '../components/HealthEntryShell';
import { ChoiceSheet, DatePickerSheet, TimePickerSheet } from '../components/PickerSheets';
import { formatClock, formatYmd, todayYmd } from '../utils/dateFormat';
import { medicationReminderService } from '../services/medicationReminderService';
import { selfReportedService, type FrequencyOption, type Medication } from '../services/selfReportedService';
import type { WelliApp } from '../state/useWelliApp';

const FALLBACK_FREQUENCIES: FrequencyOption[] = [
  { id: 'once_daily', label: 'Once a day', perDay: 1 },
  { id: 'twice_daily', label: 'Twice a day', perDay: 2 },
  { id: 'three_daily', label: 'Three times a day', perDay: 3 },
  { id: 'four_daily', label: 'Four times a day', perDay: 4 },
  { id: 'every_other_day', label: 'Every other day', perDay: 0 },
  { id: 'weekly', label: 'Once a week', perDay: 0 },
  { id: 'as_needed', label: 'Only when needed', perDay: 0 },
];
const messageOf = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

/** Same spacing as the server's doseTimes: doses spread evenly from the first one. */
const doseTimes = (first: string, perDay: number): string[] => {
  if (perDay <= 1) return [first];
  const step = Math.floor(24 / perDay);
  const [hh, mm] = first.split(':').map(Number);
  return Array.from({ length: perDay }, (_, i) => `${String((hh + i * step) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
};

/**
 * Profile > Health information > Add medication. Saves the medicine to the account and, for daily
 * schedules, sets reminders on this phone only. Always mounted; hooks run before the early return.
 */
export function AddMedicationModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const open = state.healthEntry === 'medication';
  const ownerId = state.activeFamilyId || 'me';
  const [freqs, setFreqs] = useState<FrequencyOption[]>(FALLBACK_FREQUENCIES);
  const [list, setList] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [time, setTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sheet, setSheet] = useState<null | 'freq' | 'time' | 'start' | 'end'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await selfReportedService.listMedications(ownerId);
      setList(r.medications || []);
      if (r.frequencies?.length) setFreqs(r.frequencies);
    } catch (e) { setError(messageOf(e, 'Could not load your medicines. Check your connection.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setName(''); setDose(''); setFrequency(''); setTime(''); setStartDate(todayYmd()); setEndDate(''); setNotes('');
    setSheet(null); setError(null); setDone(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  if (!open) return null;

  const freq = freqs.find((f) => f.id === frequency);
  const needsTime = Boolean(freq && freq.perDay > 0);
  const labelOf = (id: string) => freqs.find((f) => f.id === id)?.label ?? id;

  const save = async () => {
    if (busy) return;
    setError(null); setDone(null);
    if (!name.trim()) { setError('Enter the medicine name.'); return; }
    if (!dose.trim()) { setError('Enter the dose, for example 500 mg.'); return; }
    if (!freq) { setError('Choose how often you take it.'); return; }
    if (needsTime && !time) { setError('Choose the time of your first dose.'); return; }
    if (!startDate) { setError('Choose the start date.'); return; }
    if (endDate && endDate < startDate) { setError('The end date is before the start date.'); return; }
    setBusy(true);
    try {
      const r = await selfReportedService.addMedication(ownerId, {
        name: name.trim(), dose: dose.trim(), frequency: freq.id,
        ...(needsTime ? { time } : {}), startDate,
        ...(endDate ? { endDate } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      let reminderNote = '';
      if (needsTime) {
        const times = doseTimes(time, freq.perDay);
        try {
          await medicationReminderService.addSelfReportedReminders({ medicationId: r.medication.id, ownerId, name: r.medication.name, dose: r.medication.dose, times, notes: notes.trim() || undefined });
          reminderNote = ` Reminders set on this phone for ${times.map(formatClock).join(', ')}.`;
        } catch { reminderNote = ' The medicine is saved, but reminders could not be set on this phone.'; }
      }
      setDone(`Saved.${reminderNote}`);
      setName(''); setDose(''); setFrequency(''); setTime(''); setStartDate(todayYmd()); setEndDate(''); setNotes('');
      reload();
    } catch (e) { setError(messageOf(e, 'Could not save. Try again.')); }
    finally { setBusy(false); }
  };

  const remove = async (m: Medication) => {
    setError(null); setDone(null);
    try {
      await selfReportedService.removeMedication(ownerId, m.id);
      await medicationReminderService.removeRemindersFor(m.id).catch(() => undefined);
      setList((p) => p.filter((x) => x.id !== m.id));
    } catch (e) { setError(messageOf(e, 'Could not remove it. Try again.')); }
  };

  const select = (text: string, onPress: () => void, label: string, trailing = '▾') => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={h.select}>
      <Text style={text ? h.selectText : h.placeholder}>{text || label}</Text>
      <Text style={{ color: '#6B7280' }}>{trailing}</Text>
    </TouchableOpacity>
  );

  return (
    <HealthEntryShell
      title="Add medication"
      onClose={() => actions.closeHealthEntry()}
      footer={
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={[h.primary, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={h.primaryText}>Save medication</Text>}
        </TouchableOpacity>
      }
    >
      {loading && !list.length ? <ActivityIndicator color={ACCENT} /> : null}
      {list.length ? (
        <View>
          <Text style={h.section}>Your medicines</Text>
          {list.map((m) => (
            <View key={m.id} style={h.card}>
              <Text style={h.cardTitle}>{m.name} · {m.dose}</Text>
              <Text style={h.cardSub}>{labelOf(m.frequency)}{m.time ? ` · from ${formatClock(m.time)}` : ''}</Text>
              <Text style={h.cardSub}>From {formatYmd(m.startDate)}{m.endDate ? ` to ${formatYmd(m.endDate)}` : ''}</Text>
              {m.notes ? <Text style={h.cardSub}>{m.notes}</Text> : null}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => remove(m)} style={h.remove}>
                <Text style={h.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={[h.section, { marginTop: 16 }]}>Add another</Text>
        </View>
      ) : null}

      <Text style={h.label}>Medicine name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="For example, Metformin" placeholderTextColor="#9AA3AF" maxLength={120} style={h.input} accessibilityLabel="Medicine name" />

      <Text style={h.label}>Dose</Text>
      <TextInput value={dose} onChangeText={setDose} placeholder="For example, 500 mg" placeholderTextColor="#9AA3AF" maxLength={60} style={h.input} accessibilityLabel="Dose" />

      <Text style={h.label}>How often do you take it?</Text>
      {select(freq?.label ?? '', () => setSheet('freq'), 'Select frequency')}

      {needsTime ? (
        <View>
          <Text style={h.label}>{freq && freq.perDay > 1 ? 'What time is your first dose?' : 'What time do you take it?'}</Text>
          {select(time ? formatClock(time) : '', () => setSheet('time'), 'For example, 8:00 AM', '🕒')}
          {freq && freq.perDay > 1 && time ? (
            <Text style={h.hint}>Other doses are spaced through the day: {doseTimes(time, freq.perDay).map(formatClock).join(', ')}.</Text>
          ) : null}
        </View>
      ) : freq ? (
        <Text style={h.hint}>No phone reminder is set for this schedule. The medicine is still saved to your record.</Text>
      ) : null}

      <Text style={h.label}>Start date</Text>
      {select(startDate ? formatYmd(startDate) : '', () => setSheet('start'), 'Select start date', '📅')}

      <Text style={h.label}>End date (optional)</Text>
      {select(endDate ? formatYmd(endDate) : '', () => setSheet('end'), 'Select end date', '📅')}

      <Text style={h.label}>Notes (optional)</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="For example, take with food" placeholderTextColor="#9AA3AF" maxLength={200} style={h.input} accessibilityLabel="Notes" />

      <Text style={h.hint}>Phone reminders repeat every day until you remove the medicine here. They do not stop on the end date.</Text>
      {error ? <Text style={h.err} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={h.ok} accessibilityLiveRegion="polite">{done}</Text> : null}

      <ChoiceSheet visible={sheet === 'freq'} title="How often do you take it?" options={freqs.map((f) => ({ id: f.id, label: f.label }))} value={frequency} onPick={(id) => { setFrequency(id); const f = freqs.find((x) => x.id === id); if (!f || f.perDay === 0) setTime(''); }} onClose={() => setSheet(null)} />
      <TimePickerSheet visible={sheet === 'time'} title="Time of first dose" value={time} onPick={setTime} onClose={() => setSheet(null)} />
      <DatePickerSheet visible={sheet === 'start'} title="Start date" value={startDate} onPick={(v) => v && setStartDate(v)} onClose={() => setSheet(null)} />
      <DatePickerSheet visible={sheet === 'end'} title="End date" value={endDate} min={startDate || undefined} allowClear onPick={setEndDate} onClose={() => setSheet(null)} />
    </HealthEntryShell>
  );
}
