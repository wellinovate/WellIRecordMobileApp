import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { childHealthService } from '../services/childHealthService';
import { formatDisplayDate, todayIso } from '../utils/immunization';
import {
  RESULT_LABEL,
  SCREENING_LABEL,
  ageInMonths,
  bandAges,
  bandLabel,
  discussWithClinician,
  splitBands,
  type MilestoneCatalogue,
  type MilestoneDomain,
  type MilestoneRecord,
  type MilestoneStatus,
  type Screening,
  type ScreeningKind,
  type ScreeningResult,
} from '../utils/development';

const STATUS_OPTIONS: { key: MilestoneStatus; label: string }[] = [
  { key: 'achieved', label: 'Yes' },
  { key: 'not_yet', label: 'Not yet' },
  { key: 'unsure', label: 'Not sure' },
];
const KINDS = Object.keys(SCREENING_LABEL) as ScreeningKind[];
const RESULTS = Object.keys(RESULT_LABEL) as ScreeningResult[];

function formatDateInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

export function DevelopmentPanel({
  memberId,
  dob,
  canAdd,
  toast,
}: {
  memberId: string;
  dob: string;
  canAdd: boolean;
  toast: (message: string) => void;
}) {
  const theme = useTheme();
  const [catalogue, setCatalogue] = useState<MilestoneCatalogue | null>(null);
  const [records, setRecords] = useState<MilestoneRecord[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openBands, setOpenBands] = useState<Record<number, boolean>>({});
  const [form, setForm] = useState<null | { kind: ScreeningKind; date: string; result: ScreeningResult; facility: string; notes: string }>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, dev] = await Promise.all([childHealthService.fetchMilestoneCatalogue(), childHealthService.fetchDevelopment(memberId)]);
      setCatalogue(cat);
      setRecords(dev.milestones);
      setScreenings(dev.screenings);
    } catch (err: any) {
      setError(err?.message || 'Could not load development records.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const childMonths = ageInMonths(dob);
  const statusOf = useMemo(() => new Map(records.map((r) => [r.code, r.status])), [records]);
  const bands = useMemo(() => (catalogue && childMonths !== null ? splitBands(bandAges(catalogue), childMonths) : null), [catalogue, childMonths]);
  const flagged = useMemo(() => (catalogue && childMonths !== null ? discussWithClinician(catalogue, records, childMonths) : []), [catalogue, records, childMonths]);

  const setStatus = async (code: string, status: MilestoneStatus) => {
    const previous = records;
    const current = statusOf.get(code);
    // Tapping the chosen answer again clears it.
    setRecords((r) => (current === status ? r.filter((x) => x.code !== code) : [...r.filter((x) => x.code !== code), { code, status, notes: '' }]));
    try {
      if (current === status) await childHealthService.clearMilestone(memberId, code);
      else await childHealthService.setMilestone(memberId, code, status);
    } catch (err: any) {
      setRecords(previous);
      toast(err?.message || 'Could not save this answer.');
    }
  };

  const saveScreening = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await childHealthService.addScreening(memberId, form);
      setScreenings((s) => [saved, ...s].sort((a, b) => b.date.localeCompare(a.date)));
      setForm(null);
    } catch (err: any) {
      setError(err?.message || 'Could not save this screening.');
    } finally {
      setBusy(false);
    }
  };

  const removeScreening = (s: Screening) =>
    Alert.alert('Remove this screening?', `${SCREENING_LABEL[s.kind]}, ${formatDisplayDate(s.date)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await childHealthService.removeScreening(memberId, s.id);
            setScreenings((x) => x.filter((y) => y.id !== s.id));
          } catch (err: any) {
            toast(err?.message || 'Could not remove this screening.');
          }
        },
      },
    ]);

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  const band = (age: number, expanded: boolean, label?: string) => {
    if (!catalogue) return null;
    const items = catalogue.milestones.filter((m) => m.ageMonths === age);
    const answered = items.filter((m) => statusOf.has(m.code)).length;
    const open = expanded || openBands[age];
    return (
      <View key={age} style={card}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setOpenBands((o) => ({ ...o, [age]: !open }))} style={styles.bandHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>By {bandLabel(age)}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>{label ? `${label} · ` : ''}{answered} of {items.length} answered</Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 18 }}>{open ? '–' : '+'}</Text>
        </TouchableOpacity>
        {open &&
          (Object.keys(catalogue.domains) as MilestoneDomain[]).map((domain) => {
            const list = items.filter((m) => m.domain === domain);
            if (!list.length) return null;
            return (
              <View key={domain} style={{ marginTop: 10 }}>
                <Text style={[styles.label, { color: theme.muted }]}>{catalogue.domains[domain].toUpperCase()}</Text>
                {list.map((m) => {
                  const current = statusOf.get(m.code);
                  return (
                    <View key={m.code} style={styles.msRow}>
                      <Text style={[styles.sub, { color: theme.text }]}>{m.text}</Text>
                      <View style={styles.chipRow}>
                        {STATUS_OPTIONS.map((o) => {
                          const on = current === o.key;
                          const tint = o.key === 'not_yet' ? '#b45309' : o.key === 'achieved' ? '#15803d' : '#64748b';
                          return (
                            <TouchableOpacity
                              key={o.key}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              disabled={!canAdd}
                              onPress={() => setStatus(m.code, o.key)}
                              style={[styles.pick, { borderColor: on ? tint : theme.border, backgroundColor: on ? tint : theme.surface, opacity: canAdd ? 1 : 0.6 }]}
                            >
                              <Text style={{ color: on ? '#fff' : theme.text, fontSize: 12, fontWeight: '600' }}>{o.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!catalogue) {
    return (
      <View style={{ gap: 12 }}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity onPress={load} style={styles.btnAlt}><Text style={styles.btnAltText}>Try again</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {catalogue.reviewStatus !== 'reviewed' && (
        <View style={[styles.banner, { borderColor: '#f59e0b' }]}>
          <Text style={styles.bannerText}>
            This checklist is pending clinical review (version {catalogue.version}). It comes from a US programme and has not been checked for local use yet.
          </Text>
        </View>
      )}
      <Text style={[styles.sub, { color: theme.muted }]}>
        These are things most children do by each age. Children develop at different speeds. This is not a test and not a diagnosis.
      </Text>

      {flagged.length > 0 && (
        <View style={[styles.banner, { borderColor: '#b45309' }]}>
          <Text style={[styles.bannerText, { fontWeight: '700' }]}>Worth discussing with your child's clinician</Text>
          {flagged.slice(0, 6).map((m) => (
            <Text key={m.code} style={styles.bannerText}>• By {bandLabel(m.ageMonths)}: {m.text}</Text>
          ))}
          {flagged.length > 6 && <Text style={styles.bannerText}>and {flagged.length - 6} more</Text>}
          <Text style={styles.bannerText}>Ask for a developmental check at the next visit. A clinician decides what it means.</Text>
        </View>
      )}

      {childMonths === null || !bands ? (
        <Text style={[styles.sub, { color: theme.muted }]}>Add a valid date of birth in Details to see the checklist.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {bands.current !== null ? band(bands.current, true, 'Current') : <Text style={[styles.sub, { color: theme.muted }]}>The first checklist is for 2 months.</Text>}
          {bands.next !== null && band(bands.next, false, 'Coming up')}
          {bands.earlier.length > 0 && <Text style={[styles.groupTitle, { color: theme.text }]}>Earlier</Text>}
          {bands.earlier.map((a) => band(a, false))}
          {bands.current === null && bands.earlier.length === 0 && null}
        </View>
      )}
      <Text style={[styles.fine, { color: theme.mutedLight }]}>Source: {catalogue.source}.</Text>

      <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>Screening visits</Text>
      <Text style={[styles.sub, { color: theme.muted }]}>Developmental, vision, hearing and dental checks done by a clinic.</Text>
      {screenings.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>None recorded yet.</Text>}
      {screenings.map((s) => (
        <View key={s.id} style={card}>
          <Text style={[styles.name, { color: theme.text }]}>{SCREENING_LABEL[s.kind]}</Text>
          <Text style={[styles.sub, { color: s.result === 'follow_up_advised' ? '#b45309' : theme.muted }]}>
            {formatDisplayDate(s.date)} · {RESULT_LABEL[s.result]}{s.facility ? ` · ${s.facility}` : ''}
          </Text>
          {s.notes ? <Text style={[styles.sub, { color: theme.muted }]}>{s.notes}</Text> : null}
          {canAdd && (
            <TouchableOpacity onPress={() => removeScreening(s)} style={styles.link}>
              <Text style={[styles.linkText, { color: '#b91c1c' }]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {canAdd && (form ? (
        <View style={card}>
          <Text style={[styles.name, { color: theme.text }]}>Add a screening</Text>
          <Text style={[styles.label, { color: theme.muted, marginTop: 8 }]}>TYPE</Text>
          <View style={styles.chipRow}>
            {KINDS.map((k) => {
              const on = form.kind === k;
              return (
                <TouchableOpacity key={k} accessibilityRole="button" onPress={() => setForm((f) => f && { ...f, kind: k })}
                  style={[styles.pick, { borderColor: on ? '#082F67' : theme.border, backgroundColor: on ? '#082F67' : theme.surface }]}>
                  <Text style={{ color: on ? '#fff' : theme.text, fontSize: 12, fontWeight: '600' }}>{SCREENING_LABEL[k]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.label, { color: theme.muted, marginTop: 10 }]}>RESULT</Text>
          <View style={styles.chipRow}>
            {RESULTS.map((r) => {
              const on = form.result === r;
              return (
                <TouchableOpacity key={r} accessibilityRole="button" onPress={() => setForm((f) => f && { ...f, result: r })}
                  style={[styles.pick, { borderColor: on ? '#082F67' : theme.border, backgroundColor: on ? '#082F67' : theme.surface }]}>
                  <Text style={{ color: on ? '#fff' : theme.text, fontSize: 12, fontWeight: '600' }}>{RESULT_LABEL[r]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {([['date', 'Date (YYYY-MM-DD) *'], ['facility', 'Clinic or hospital'], ['notes', 'Notes']] as const).map(([key, label]) => (
            <View key={key} style={{ marginTop: 10 }}>
              <Text style={[styles.label, { color: theme.muted }]}>{label.toUpperCase()}</Text>
              <TextInput
                value={form[key]}
                onChangeText={(v) => setForm((f) => f && { ...f, [key]: key === 'date' ? formatDateInput(v) : v })}
                placeholderTextColor={theme.mutedLight}
                keyboardType={key === 'date' ? 'numbers-and-punctuation' : 'default'}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              />
            </View>
          ))}
          <View style={{ gap: 8, marginTop: 12 }}>
            <TouchableOpacity accessibilityRole="button" disabled={busy || form.date.length !== 10} onPress={saveScreening} style={[styles.btn, (busy || form.date.length !== 10) && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save screening</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setForm(null)} style={styles.btnAlt}><Text style={styles.btnAltText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={() => setForm({ kind: 'developmental', date: todayIso(), result: 'no_concerns', facility: '', notes: '' })} style={styles.btn}>
          <Text style={styles.btnText}>Add a screening</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  bandHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 19 },
  fine: { fontSize: 11, lineHeight: 16 },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  msRow: { paddingVertical: 8, gap: 6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 46 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#fffbeb', gap: 4 },
  bannerText: { color: '#92400e', fontSize: 12, lineHeight: 17 },
});
