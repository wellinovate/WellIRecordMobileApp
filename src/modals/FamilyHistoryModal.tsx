import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ACCENT, h, HealthEntryShell } from '../components/HealthEntryShell';
import { Modal } from '../components/ActivityModal';
import { selfReportedService, type FamilyEntry } from '../services/selfReportedService';
import type { WelliApp } from '../state/useWelliApp';

const FALLBACK_RELATIVES = ['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Daughter', 'Son', 'Other relative'];
const messageOf = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

/**
 * Profile > Health information > Family history. Which blood relative has had which condition.
 * The condition picker is a searchable multi-select with Confirm. Always mounted; hooks before the early return.
 */
export function FamilyHistoryModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const open = state.healthEntry === 'family';
  const ownerId = state.activeFamilyId || 'me';
  const [relatives, setRelatives] = useState<string[]>(FALLBACK_RELATIVES);
  const [conditionList, setConditionList] = useState<string[]>([]);
  const [entries, setEntries] = useState<FamilyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [relative, setRelative] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [age, setAge] = useState('');
  const [living, setLiving] = useState<boolean | undefined>(undefined);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [o, l] = await Promise.all([selfReportedService.familyOptions(), selfReportedService.listFamily(ownerId)]);
      if (o.relatives?.length) setRelatives(o.relatives);
      setConditionList(o.conditions || []);
      setEntries(l.entries || []);
    } catch (e) { setError(messageOf(e, 'Could not load family history. Check your connection.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setRelative(''); setConditions([]); setOtherText(''); setAge(''); setLiving(undefined);
    setPicker(false); setQuery(''); setError(null); setDone(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conditionList.filter((c) => c.toLowerCase().includes(q)) : conditionList;
  }, [conditionList, query]);

  if (!open) return null;

  const toggle = (c: string) => setDraft((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length >= 15 ? p : [...p, c]));
  const openPicker = () => { setDraft(conditions); setQuery(''); setPicker(true); };
  const confirmPicker = () => { setConditions(draft); setPicker(false); };
  const hasOther = conditions.includes('Other');

  const save = async () => {
    if (busy) return;
    setError(null); setDone(null);
    if (!relative) { setError('Choose the relative.'); return; }
    if (!conditions.length) { setError('Choose at least one condition.'); return; }
    if (hasOther && !otherText.trim()) { setError('Say what the other condition is.'); return; }
    setBusy(true);
    try {
      await selfReportedService.addFamily(ownerId, {
        relative, conditions,
        ...(hasOther ? { otherText: otherText.trim() } : {}),
        ...(age.trim() ? { ageAtDiagnosis: age.trim() } : {}),
        ...(living !== undefined ? { living } : {}),
      });
      setDone('Saved.');
      setRelative(''); setConditions([]); setOtherText(''); setAge(''); setLiving(undefined);
      reload();
    } catch (e) { setError(messageOf(e, 'Could not save. Try again.')); }
    finally { setBusy(false); }
  };

  const remove = async (e: FamilyEntry) => {
    setError(null); setDone(null);
    try { await selfReportedService.removeFamily(ownerId, e.id); setEntries((p) => p.filter((x) => x.id !== e.id)); }
    catch (err) { setError(messageOf(err, 'Could not remove it. Try again.')); }
  };

  const chipStyle = (on: boolean) => [h.chip, on && { backgroundColor: ACCENT, borderColor: ACCENT }];

  return (
    <HealthEntryShell
      title="Family history"
      onClose={() => actions.closeHealthEntry()}
      footer={
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={[h.primary, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={h.primaryText}>Save</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={h.intro}>Add conditions that blood relatives have had. This is a record of what you know. It is not a risk score or a diagnosis.</Text>
      {loading && !entries.length ? <ActivityIndicator color={ACCENT} /> : null}

      {entries.length ? (
        <View>
          <Text style={h.section}>Saved</Text>
          {entries.map((e) => (
            <View key={e.id} style={h.card}>
              <Text style={h.cardTitle}>{e.relative}</Text>
              <Text style={h.cardSub}>{e.conditions.map((c) => (c === 'Other' && e.otherText ? e.otherText : c)).join(', ')}</Text>
              {e.ageAtDiagnosis !== null && e.ageAtDiagnosis !== undefined ? <Text style={h.cardSub}>Age at diagnosis: {e.ageAtDiagnosis}</Text> : null}
              {e.living === true ? <Text style={h.cardSub}>Living</Text> : e.living === false ? <Text style={h.cardSub}>Deceased</Text> : null}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${e.relative}`} onPress={() => remove(e)} style={h.remove}>
                <Text style={h.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={[h.section, { marginTop: 16 }]}>Add another</Text>
        </View>
      ) : null}

      <Text style={h.label}>Relative</Text>
      <View style={h.chips}>
        {relatives.map((r) => (
          <TouchableOpacity key={r} accessibilityRole="button" accessibilityState={{ selected: relative === r }} onPress={() => setRelative(r)} style={chipStyle(relative === r)}>
            <Text style={[h.chipText, relative === r && { color: '#fff' }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={h.label}>Conditions</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select condition" onPress={openPicker} style={h.select}>
        <Text style={conditions.length ? [h.selectText, { flex: 1 }] : h.placeholder} numberOfLines={2}>{conditions.length ? conditions.join(', ') : 'Select condition'}</Text>
        <Text style={{ color: '#6B7280' }}>▾</Text>
      </TouchableOpacity>
      {hasOther ? (
        <TextInput value={otherText} onChangeText={setOtherText} placeholder="What is the other condition?" placeholderTextColor="#9AA3AF" maxLength={80} style={[h.input, { marginTop: 10 }]} accessibilityLabel="Other condition" />
      ) : null}

      <Text style={h.label}>Age when diagnosed (optional)</Text>
      <TextInput value={age} onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="For example, 52" placeholderTextColor="#9AA3AF" style={h.input} accessibilityLabel="Age at diagnosis" />

      <Text style={h.label}>Living? (optional)</Text>
      <View style={h.chips}>
        {[{ v: true, t: 'Living' }, { v: false, t: 'Deceased' }].map((o) => (
          <TouchableOpacity key={o.t} accessibilityRole="button" accessibilityState={{ selected: living === o.v }} onPress={() => setLiving(living === o.v ? undefined : o.v)} style={chipStyle(living === o.v)}>
            <Text style={[h.chipText, living === o.v && { color: '#fff' }]}>{o.t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={h.err} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={h.ok} accessibilityLiveRegion="polite">{done}</Text> : null}

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,24,48,0.45)', justifyContent: 'flex-end' }}>
          <TouchableOpacity accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setPicker(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#082F67', marginBottom: 12 }}>Select condition</Text>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search conditions" placeholderTextColor="#9AA3AF" style={h.input} accessibilityLabel="Search conditions" autoCorrect={false} />
            <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
              {shown.map((c) => {
                const on = draft.includes(c);
                return (
                  <TouchableOpacity key={c} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(c)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? ACCENT : '#B8C2CF', backgroundColor: on ? ACCENT : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      {on ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                    </View>
                    <Text style={{ fontSize: 16, color: '#111827', flex: 1 }}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
              {!shown.length ? <Text style={[h.hint, { paddingVertical: 16 }]}>No match. Choose "Other" to type it in.</Text> : null}
            </ScrollView>
            {draft.length >= 15 ? <Text style={h.hint}>You can choose up to 15.</Text> : null}
            <TouchableOpacity accessibilityRole="button" onPress={confirmPicker} style={[h.primary, { marginTop: 12 }]}>
              <Text style={h.primaryText}>Confirm{draft.length ? ` (${draft.length})` : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </HealthEntryShell>
  );
}
