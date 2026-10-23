import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { ModalHeader } from '../components/ModalHeader';
import { ChildAccessPanel } from './ChildAccessPanel';
import { ChildReminderCard } from './ChildReminderCard';
import { FacilityCodeCard } from './FacilityCodeCard';
import { DevelopmentPanel } from './DevelopmentPanel';
import { SchoolProfileCard } from './SchoolProfileCard';
import { GrowthChart } from './GrowthChart';
import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';
import {
  childHealthService,
  type ChildProfileBundle,
  type GrowthEntry,
} from '../services/childHealthService';
import { childCache, childOfflineQueue, isNetworkError, type QueueItem } from '../utils/childOfflineQueue';
import {
  STATUS_COLOR,
  STATUS_LABEL,
  ageLabel,
  buildDoseRows,
  formatDisplayDate,
  parseIsoDate,
  summarize,
  todayIso,
  type DoseRow,
  type ImmunizationSchedule,
  type Vaccination,
} from '../utils/immunization';

type Tab = 'overview' | 'vaccines' | 'growth' | 'development' | 'details' | 'access';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'vaccines', label: 'Vaccines' },
  { key: 'growth', label: 'Growth' },
  { key: 'development', label: 'Development' },
  { key: 'details', label: 'Details' },
  { key: 'access', label: 'Access' },
];

const DELIVERY = ['Vaginal', 'Caesarean', 'Assisted'] as const;
const NOT_RECORDED = 'Not recorded';

const EMPTY_VAX = {
  administeredDate: '',
  facility: '',
  provider: '',
  lotNumber: '',
  manufacturer: '',
  expiryDate: '',
  site: '',
  reaction: '',
};
const EMPTY_GROWTH = { measuredOn: '', weightKg: '', lengthCm: '', headCircumferenceCm: '', notes: '' };

function milestoneLabel(days: number): string {
  if (days === 0) return 'At birth';
  if (days < 150) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function ChildProfileModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const memberId = state.childProfileMemberId;
  const member = state.familyMembers.find((f) => f.id === memberId);
  const guardian = state.familyMembers[0];
  // A guardian added by someone else only gets what the primary guardian granted.
  const canAdd = !member?.sharedWithMe || Boolean(member?.myPermissions?.addRecords);

  const [tab, setTab] = useState<Tab>('overview');
  const [schedule, setSchedule] = useState<ImmunizationSchedule | null>(null);
  const [bundle, setBundle] = useState<ChildProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null); // set when showing a saved copy
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const [vaxCode, setVaxCode] = useState<string | null>(null);
  const [vax, setVax] = useState(EMPTY_VAX);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [growthForm, setGrowthForm] = useState<typeof EMPTY_GROWTH | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const [sch, data] = await Promise.all([
        childHealthService.fetchSchedule(),
        childHealthService.fetchBundle(memberId),
      ]);
      setSchedule(sch);
      setBundle(data);
      setSavedAt(null);
      childCache.set(memberId, { bundle: data, schedule: sch, savedAt: Date.now() }).catch(() => {});
    } catch (err: any) {
      const cached = isNetworkError(err) ? await childCache.get(memberId) : null;
      if (cached) {
        setSchedule(cached.schedule);
        setBundle(cached.bundle);
        setSavedAt(cached.savedAt);
      } else {
        setError(err?.message || 'Could not load this profile. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  const refreshQueue = useCallback(async () => {
    if (!memberId) return;
    setQueue(await childOfflineQueue.list(memberId));
  }, [memberId]);

  useEffect(() => {
    refreshQueue();
    return childOfflineQueue.subscribe(() => {
      refreshQueue();
    });
  }, [refreshQueue]);

  const syncNow = async () => {
    setBusy(true);
    try {
      const sent = await childOfflineQueue.flush();
      await load();
      await refreshQueue();
      if (sent > 0) actions.showToast(sent === 1 ? '1 entry synced' : `${sent} entries synced`);
      else actions.showToast('Still waiting for a connection');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const profile = bundle?.profile;
  const details = profile?.childProfile || {};
  const dob = profile?.dateOfBirth || member?.dob || '';

  // Fill the details form once, after the first load.
  useEffect(() => {
    if (!profile || draftReady) return;
    const d = profile.childProfile || {};
    setDraft({
      preferredName: d.preferredName || '',
      gender: profile.gender || '',
      bloodType: profile.bloodType || '',
      genotype: profile.genotype || '',
      allergies: profile.allergies || '',
      criticalAlerts: d.criticalAlerts || '',
      birthRegistrationNo: d.birthRegistrationNo || '',
      birthFacility: d.birthFacility || '',
      gestationalAgeWeeks: d.gestationalAgeWeeks != null ? String(d.gestationalAgeWeeks) : '',
      birthWeightKg: d.birthWeightKg != null ? String(d.birthWeightKg) : '',
      birthLengthCm: d.birthLengthCm != null ? String(d.birthLengthCm) : '',
      deliveryMode: d.deliveryMode || '',
      address: d.address || '',
      community: d.community || '',
      state: d.state || '',
      lga: d.lga || '',
      ecName: d.emergencyContact?.name || '',
      ecRelationship: d.emergencyContact?.relationship || '',
      ecPhone: d.emergencyContact?.phone || '',
    });
    setDraftReady(true);
  }, [profile, draftReady]);

  // Entries saved on this phone and not yet sent. They show with a "Waiting to sync" label.
  const pending = useMemo(() => queue.filter((q) => !q.blockedReason), [queue]);
  const blocked = useMemo(() => queue.filter((q) => q.blockedReason), [queue]);
  const pendingIds = useMemo(() => new Set(queue.map((q) => q.id)), [queue]);

  const vaccinations: Vaccination[] = useMemo(() => {
    const server = bundle?.vaccinations || [];
    const taken = new Set(server.map((v) => v.vaccineCode));
    const local = queue
      .filter((q) => q.kind === 'vaccination' && !taken.has(q.payload.vaccineCode))
      .map((q): Vaccination => {
        const p = q.payload as any;
        const dose = schedule?.doses.find((d) => d.code === p.vaccineCode);
        return {
          id: q.id,
          vaccineCode: p.vaccineCode,
          vaccineName: dose?.vaccine || p.vaccineCode,
          administeredDate: p.administeredDate || '',
          facility: p.facility || '',
          provider: p.provider || '',
          lotNumber: p.lotNumber || '',
          manufacturer: p.manufacturer || '',
          expiryDate: p.expiryDate || '',
          site: p.site || '',
          route: dose?.route || '',
          reaction: p.reaction || '',
          notes: '',
          verification: 'caregiver_reported',
          verifiedBy: '',
          verifiedAt: null,
          verificationSource: '',
        };
      });
    return [...server, ...local];
  }, [bundle, queue, schedule]);

  const growthEntries: GrowthEntry[] = useMemo(() => {
    const server = bundle?.growth || [];
    const local = queue
      .filter((q) => q.kind === 'growth')
      .map((q): GrowthEntry => {
        const p = q.payload as any;
        const num = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
        return {
          id: q.id,
          measuredOn: p.measuredOn,
          weightKg: num(p.weightKg),
          lengthCm: num(p.lengthCm),
          headCircumferenceCm: num(p.headCircumferenceCm),
          source: 'caregiver',
          notes: p.notes || '',
        };
      });
    return [...server, ...local].sort((x, y) => y.measuredOn.localeCompare(x.measuredOn));
  }, [bundle, queue]);

  const rows: DoseRow[] = useMemo(
    () => (schedule && bundle ? buildDoseRows(schedule, dob, vaccinations) : []),
    [schedule, bundle, dob, vaccinations],
  );
  const counts = useMemo(() => summarize(rows), [rows]);
  const routine = rows.filter((r) => r.dose.track === 'routine');
  const programme = rows.filter((r) => r.dose.track === 'programme');
  const notRecorded = rows.filter((r) => r.status === 'notRecorded');

  const close = actions.closeChildProfile;
  const name = details.preferredName || profile?.fullName || member?.name || 'Child';
  const dobValid = Boolean(parseIsoDate(dob));

  const fail = (err: any, fallback: string) => {
    const message = err?.message || fallback;
    setError(message);
    actions.showToast(message);
  };

  const saveVaccination = async () => {
    if (!memberId || !vaxCode) return;
    setBusy(true);
    setError(null);
    try {
      const input = { vaccineCode: vaxCode, ...vax };
      try {
        const saved = await childHealthService.addVaccination(memberId, input);
        setBundle((b) => (b ? { ...b, vaccinations: [...b.vaccinations, saved] } : b));
        actions.showToast('Dose saved. It stays unverified until a clinic confirms it.');
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await childOfflineQueue.addVaccination(memberId, input);
        actions.showToast('No connection. Saved on this phone and will sync when you are online.');
      }
      setVaxCode(null);
      setVax(EMPTY_VAX);
    } catch (err) {
      fail(err, 'Could not save this dose.');
    } finally {
      setBusy(false);
    }
  };

  const removeVaccination = (v: Vaccination) => {
    if (!memberId) return;
    Alert.alert('Remove this dose?', `${v.vaccineName} given on ${formatDisplayDate(v.administeredDate)}.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            if (pendingIds.has(v.id)) {
              await childOfflineQueue.remove(v.id);
              return;
            }
            await childHealthService.removeVaccination(memberId, v.id);
            setBundle((b) => (b ? { ...b, vaccinations: b.vaccinations.filter((x) => x.id !== v.id) } : b));
          } catch (err) {
            fail(err, 'Could not remove this dose.');
          }
        },
      },
    ]);
  };

  const saveGrowth = async () => {
    if (!memberId || !growthForm) return;
    setBusy(true);
    setError(null);
    try {
      try {
        const saved = await childHealthService.addGrowth(memberId, growthForm);
        setBundle((b) => (b ? { ...b, growth: [saved, ...b.growth].sort((x, y) => y.measuredOn.localeCompare(x.measuredOn)) } : b));
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await childOfflineQueue.addGrowth(memberId, growthForm);
        actions.showToast('No connection. Saved on this phone and will sync when you are online.');
      }
      setGrowthForm(null);
    } catch (err) {
      fail(err, 'Could not save this measurement.');
    } finally {
      setBusy(false);
    }
  };

  const removeGrowth = (g: GrowthEntry) => {
    if (!memberId) return;
    Alert.alert('Remove this measurement?', formatDisplayDate(g.measuredOn), [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            if (pendingIds.has(g.id)) {
              await childOfflineQueue.remove(g.id);
              return;
            }
            await childHealthService.removeGrowth(memberId, g.id);
            setBundle((b) => (b ? { ...b, growth: b.growth.filter((x) => x.id !== g.id) } : b));
          } catch (err) {
            fail(err, 'Could not remove this measurement.');
          }
        },
      },
    ]);
  };

  const saveDetails = async () => {
    if (!memberId) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await childHealthService.updateProfile(memberId, {
        preferredName: draft.preferredName,
        gender: draft.gender,
        bloodType: draft.bloodType,
        genotype: draft.genotype,
        allergies: draft.allergies,
        criticalAlerts: draft.criticalAlerts,
        birthRegistrationNo: draft.birthRegistrationNo,
        birthFacility: draft.birthFacility,
        gestationalAgeWeeks: draft.gestationalAgeWeeks as any,
        birthWeightKg: draft.birthWeightKg as any,
        birthLengthCm: draft.birthLengthCm as any,
        deliveryMode: (draft.deliveryMode || null) as any,
        address: draft.address,
        community: draft.community,
        state: draft.state,
        lga: draft.lga,
        emergencyContact: { name: draft.ecName, relationship: draft.ecRelationship, phone: draft.ecPhone },
      });
      setBundle((b) => (b ? { ...b, profile: saved } : b));
      actions.applyChildProfile(memberId, saved);
      actions.showToast('Details saved');
    } catch (err) {
      fail(err, 'Could not save these details.');
    } finally {
      setBusy(false);
    }
  };

  const emergencyText = () => {
    const ec = details.emergencyContact;
    return [
      `Emergency card: ${profile?.fullName || name}`,
      dobValid ? `Date of birth: ${formatDisplayDate(dob)} (${ageLabel(dob)})` : null,
      `WelliID: ${profile?.wrId || NOT_RECORDED}`,
      `Blood group: ${profile?.bloodType || NOT_RECORDED}`,
      `Genotype: ${profile?.genotype || NOT_RECORDED}`,
      `Allergies: ${profile?.allergies || NOT_RECORDED}`,
      `Critical alerts: ${details.criticalAlerts || 'None recorded'}`,
      `Emergency contact: ${[ec?.name, ec?.relationship && `(${ec.relationship})`, ec?.phone].filter(Boolean).join(' ') || NOT_RECORDED}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const historyText = () => {
    const lines = rows
      .filter((r) => r.record)
      .map((r) => {
        const v = r.record!;
        const bits = [v.facility, v.lotNumber && `lot ${v.lotNumber}`].filter(Boolean).join(', ');
        return `${v.vaccineName}: ${formatDisplayDate(v.administeredDate)}${bits ? ` (${bits})` : ''} [${v.verification === 'provider_verified' ? 'verified by provider' : 'reported by guardian'}]`;
      });
    return [`Vaccination history: ${profile?.fullName || name}`, `Schedule version ${schedule?.version || ''}`, ...(lines.length ? lines : ['No doses recorded'])].join('\n');
  };

  // The text goes to the share sheet, so the guardian picks the app. Nothing is sent to a service from here.
  const exportRecord = async () => {
    if (!memberId) return;
    setBusy(true);
    try {
      const json = await childHealthService.exportFhir(memberId);
      await Share.share({ message: json, title: `${name} health record (FHIR)` });
    } catch (err) {
      fail(err, 'Could not export the record. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareText = (text: string, title: string) => Share.share({ message: text, title }).catch(() => {});

  // ----- small view helpers -----
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const label = (text: string) => <Text style={[styles.label, { color: theme.muted }]}>{text}</Text>;

  const field = (key: string, title: string, opts: { placeholder?: string; numeric?: boolean; multiline?: boolean } = {}) => (
    <View style={styles.fieldWrap} key={key}>
      {label(title)}
      <TextInput
        value={draft[key] || ''}
        onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
        placeholder={opts.placeholder}
        placeholderTextColor={theme.mutedLight}
        keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
        multiline={opts.multiline}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }, opts.multiline && { minHeight: 72, textAlignVertical: 'top' }]}
      />
    </View>
  );

  const formInput = (value: string, onChange: (v: string) => void, title: string, opts: { date?: boolean; numeric?: boolean; placeholder?: string } = {}) => (
    <View style={styles.fieldWrap}>
      {label(title)}
      <TextInput
        value={value}
        onChangeText={(v) => onChange(opts.date ? formatDateInput(v) : v)}
        placeholder={opts.date ? 'YYYY-MM-DD' : opts.placeholder}
        placeholderTextColor={theme.mutedLight}
        keyboardType={opts.date || opts.numeric ? 'numbers-and-punctuation' : 'default'}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
      />
    </View>
  );

  const button = (text: string, onPress: () => void, kind: 'primary' | 'alt' = 'primary', disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={[kind === 'primary' ? styles.btn : styles.btnAlt, (disabled || busy) && { opacity: 0.6 }]}
    >
      {busy && kind === 'primary' ? <ActivityIndicator color="#fff" /> : <Text style={kind === 'primary' ? styles.btnText : styles.btnAltText}>{text}</Text>}
    </TouchableOpacity>
  );

  const tiles = (
    <View style={styles.tileRow}>
      {[
        ['Completed', counts.completed, STATUS_COLOR.verified],
        ['Upcoming', counts.upcoming, STATUS_COLOR.due],
        ['Not recorded', counts.notRecorded, STATUS_COLOR.notRecorded],
        ['Unverified', counts.unverified, STATUS_COLOR.unverified],
      ].map(([t, n, c]) => (
        <View key={String(t)} style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.tileNum, { color: c as string }]}>{n as number}</Text>
          <Text style={[styles.tileLabel, { color: theme.muted }]}>{t as string}</Text>
        </View>
      ))}
    </View>
  );

  const reviewBanner =
    schedule && schedule.reviewStatus !== 'reviewed' ? (
      <View style={[styles.banner, { borderColor: '#f59e0b' }]}>
        <Text style={styles.bannerText}>
          The schedule is pending clinical review (version {schedule.version}). Use it as a guide. Your child's clinic decides what is due, including catch-up doses.
        </Text>
      </View>
    ) : null;

  const syncBanner =
    savedAt || queue.length > 0 ? (
      <View style={[styles.banner, { borderColor: '#f59e0b', marginBottom: 12, gap: 6 }]}>
        {savedAt ? (
          <Text style={styles.bannerText}>
            Showing the copy saved on {new Date(savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}. It may be out of date.
          </Text>
        ) : null}
        {pending.length > 0 ? (
          <Text style={styles.bannerText}>
            {pending.length === 1 ? '1 entry is' : `${pending.length} entries are`} saved on this phone and waiting to sync.
          </Text>
        ) : null}
        {blocked.map((b) => (
          <View key={b.id} style={{ gap: 2 }}>
            <Text style={styles.bannerText}>
              {b.kind === 'vaccination' ? 'A vaccine dose' : 'A measurement'} could not be saved: {b.blockedReason}
            </Text>
            <TouchableOpacity onPress={() => childOfflineQueue.remove(b.id)} style={styles.link}>
              <Text style={[styles.linkText, { color: '#b91c1c' }]}>Discard this entry</Text>
            </TouchableOpacity>
          </View>
        ))}
        {pending.length > 0 || savedAt ? (
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={syncNow} style={styles.link}>
            <Text style={styles.linkText}>Sync now</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : null;

  // ----- tabs -----
  const overview = () => {
    const ec = details.emergencyContact;
    const latest = growthEntries[0];
    return (
      <View style={{ gap: 12 }}>
        <View style={card}>
          <Text style={[styles.name, { color: theme.text }]}>{profile?.fullName || name}</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>
            {[dobValid ? `${ageLabel(dob)} old` : null, dobValid ? `Born ${formatDisplayDate(dob)}` : null, profile?.gender || null].filter(Boolean).join(' · ') || 'Add a date of birth in Details'}
          </Text>
          <Text style={[styles.sub, { color: theme.muted }]}>Guardian: {guardian?.name || 'You'}</Text>
          <View style={styles.idRow}>
            <View style={{ flex: 1 }}>
              {label('WELLIID')}
              <Text selectable style={[styles.wrId, { color: theme.text }]}>{profile?.wrId || '—'}</Text>
              <Text style={[styles.sub, { color: theme.muted }]}>The QR code holds the WelliID only. A clinic still needs your consent to open records.</Text>
            </View>
            {profile?.wrId ? (
              <View style={styles.qr}>
                <QRCode value={profile.wrId} size={92} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={card}>
          <Text style={[styles.heading, { color: theme.text }]}>Emergency card</Text>
          {[
            ['Blood group', profile?.bloodType],
            ['Genotype', profile?.genotype],
            ['Allergies', profile?.allergies],
            ['Critical alerts', details.criticalAlerts],
            ['Emergency contact', [ec?.name, ec?.relationship && `(${ec.relationship})`, ec?.phone].filter(Boolean).join(' ')],
          ].map(([k, v]) => (
            <View key={k as string} style={styles.kv}>
              <Text style={[styles.k, { color: theme.muted }]}>{k}</Text>
              <Text style={[styles.v, { color: v ? theme.text : theme.mutedLight }]}>{v || NOT_RECORDED}</Text>
            </View>
          ))}
          <View style={{ height: 8 }} />
          {button('Share emergency card', () => shareText(emergencyText(), 'Emergency card'), 'alt')}
          <View style={{ height: 8 }} />
          {button('Export full record (FHIR)', exportRecord, 'alt')}
          <Text style={[styles.fine, { color: theme.mutedLight }]}>
            A standard file other health systems can read. It goes to the app you choose from the share sheet.
          </Text>
          <TouchableOpacity onPress={() => setTab('details')} style={styles.link}>
            <Text style={styles.linkText}>Edit these details</Text>
          </TouchableOpacity>
        </View>

        <View style={card}>
          <Text style={[styles.heading, { color: theme.text }]}>Vaccines</Text>
          {tiles}
          {notRecorded.length > 0 && (
            <Text style={[styles.sub, { color: STATUS_COLOR.notRecorded }]}>
              No record yet for: {notRecorded.slice(0, 4).map((r) => `${r.dose.vaccine}${r.dose.doseNumber ? ` ${r.dose.doseNumber}` : ''}`).join(', ')}
              {notRecorded.length > 4 ? ` and ${notRecorded.length - 4} more` : ''}. This may only mean the dose was not entered. Add it from the child's card, or ask your clinic before any catch-up dose.
            </Text>
          )}
          <TouchableOpacity onPress={() => setTab('vaccines')} style={styles.link}>
            <Text style={styles.linkText}>Open vaccine schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={card}>
          <Text style={[styles.heading, { color: theme.text }]}>Latest growth</Text>
          {latest ? (
            <Text style={[styles.sub, { color: theme.text }]}>
              {formatDisplayDate(latest.measuredOn)}: {[latest.weightKg != null && `${latest.weightKg} kg`, latest.lengthCm != null && `${latest.lengthCm} cm`, latest.headCircumferenceCm != null && `head ${latest.headCircumferenceCm} cm`].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <Text style={[styles.sub, { color: theme.muted }]}>No measurements yet.</Text>
          )}
          <TouchableOpacity onPress={() => setTab('growth')} style={styles.link}>
            <Text style={styles.linkText}>Open growth log</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const doseRow = (row: DoseRow) => {
    const open = openRow === row.dose.code;
    const color = STATUS_COLOR[row.status];
    return (
      <View key={row.dose.code} style={[styles.doseCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setOpenRow(open ? null : row.dose.code)}
          style={styles.doseHead}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>
              {row.dose.vaccine}{row.dose.doseNumber ? ` · dose ${row.dose.doseNumber}` : ''}
            </Text>
            <Text style={[styles.sub, { color: theme.muted }]}>
              {row.record ? `Given ${formatDisplayDate(row.record.administeredDate)}` : `Due ${formatDisplayDate(row.dueDate)}`}
            </Text>
          </View>
          <View style={[styles.chip, { borderColor: color }]}>
            <Text style={[styles.chipText, { color }]}>{STATUS_LABEL[row.status]}</Text>
          </View>
        </TouchableOpacity>
        {open && (
          <View style={{ gap: 4, marginTop: 8 }}>
            <Text style={[styles.sub, { color: theme.muted }]}>Protects against: {row.dose.antigen}{row.dose.route ? ` · ${row.dose.route}` : ''}</Text>
            {row.dose.note ? <Text style={[styles.sub, { color: theme.muted }]}>{row.dose.note}</Text> : null}
            {row.record ? (
              <>
                {[
                  ['Facility', row.record.facility],
                  ['Health worker', row.record.provider],
                  ['Batch', [row.record.lotNumber, row.record.manufacturer].filter(Boolean).join(' · ')],
                  ['Expiry', row.record.expiryDate ? formatDisplayDate(row.record.expiryDate) : ''],
                  ['Injection site', row.record.site],
                  ['Reaction', row.record.reaction],
                ].map(([k, v]) => (v ? (
                  <View key={k} style={styles.kv}>
                    <Text style={[styles.k, { color: theme.muted }]}>{k}</Text>
                    <Text style={[styles.v, { color: theme.text }]}>{v}</Text>
                  </View>
                ) : null))}
                <Text style={[styles.sub, { color }]}>
                  {row.record.verification === 'provider_verified'
                    ? `Verified by ${row.record.verifiedBy || 'a provider'}${row.record.verifiedAt ? ` on ${formatDisplayDate(String(row.record.verifiedAt).slice(0, 10))}` : ''}.`
                    : pendingIds.has(row.record.id)
                      ? 'Waiting to sync. Saved on this phone until you are online.'
                      : 'Reported by you. A clinic can confirm it at the next visit.'}
                </Text>
                {canAdd && row.record.verification !== 'provider_verified' &&
                  button('Remove this dose', () => removeVaccination(row.record!), 'alt')}
              </>
            ) : canAdd ? (
              button('Record this dose', () => {
                setVaxCode(row.dose.code);
                setVax({ ...EMPTY_VAX, administeredDate: todayIso() });
              }, 'alt')
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const vaccineForm = () => {
    const row = rows.find((r) => r.dose.code === vaxCode);
    if (!row) return null;
    return (
      <View style={card}>
        <Text style={[styles.heading, { color: theme.text }]}>Record {row.dose.vaccine}{row.dose.doseNumber ? ` dose ${row.dose.doseNumber}` : ''}</Text>
        <Text style={[styles.sub, { color: theme.muted }]}>Copy details from the vaccination card. Leave out anything the card does not show.</Text>
        {formInput(vax.administeredDate, (v) => setVax((x) => ({ ...x, administeredDate: v })), 'Date given *', { date: true })}
        {formInput(vax.facility, (v) => setVax((x) => ({ ...x, facility: v })), 'Clinic or hospital')}
        {formInput(vax.provider, (v) => setVax((x) => ({ ...x, provider: v })), 'Health worker')}
        {formInput(vax.lotNumber, (v) => setVax((x) => ({ ...x, lotNumber: v })), 'Batch or lot number')}
        {formInput(vax.manufacturer, (v) => setVax((x) => ({ ...x, manufacturer: v })), 'Manufacturer')}
        {formInput(vax.expiryDate, (v) => setVax((x) => ({ ...x, expiryDate: v })), 'Expiry date', { date: true })}
        {formInput(vax.site, (v) => setVax((x) => ({ ...x, site: v })), 'Injection site', { placeholder: 'e.g. left thigh' })}
        {formInput(vax.reaction, (v) => setVax((x) => ({ ...x, reaction: v })), 'Reaction, if any')}
        <View style={{ gap: 8, marginTop: 4 }}>
          {button('Save dose', saveVaccination, 'primary', !vax.administeredDate)}
          {button('Cancel', () => setVaxCode(null), 'alt')}
        </View>
      </View>
    );
  };

  const vaccines = () => {
    if (!dobValid) {
      return <Text style={[styles.sub, { color: theme.muted }]}>Add a valid date of birth in Details to see the schedule.</Text>;
    }
    if (vaxCode) return vaccineForm();
    const groups = new Map<number, DoseRow[]>();
    routine.forEach((r) => groups.set(r.dose.dueDays, [...(groups.get(r.dose.dueDays) || []), r]));
    return (
      <View style={{ gap: 12 }}>
        {reviewBanner}
        {tiles}
        <Text style={[styles.sub, { color: theme.muted }]}>
          Doses you record stay "Reported by you" until a clinic confirms them.
        </Text>
        {[...groups.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([days, list]) => (
            <View key={days} style={{ gap: 8 }}>
              <Text style={[styles.groupTitle, { color: theme.text }]}>{milestoneLabel(days)}</Text>
              {list.map(doseRow)}
            </View>
          ))}
        {programme.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.groupTitle, { color: theme.text }]}>Programme and regional doses</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>These depend on your state or a campaign. They are never flagged as missing.</Text>
            {programme.map(doseRow)}
          </View>
        )}
        {button('Share vaccination history', () => shareText(historyText(), 'Vaccination history'), 'alt')}
        {schedule && (
          <Text style={[styles.fine, { color: theme.mutedLight }]}>
            Sources: {schedule.sources.join('; ')}.
          </Text>
        )}
      </View>
    );
  };

  const growth = () => (
    <View style={{ gap: 12 }}>
      {growthForm ? (
        <View style={card}>
          <Text style={[styles.heading, { color: theme.text }]}>Add a measurement</Text>
          {formInput(growthForm.measuredOn, (v) => setGrowthForm((g) => g && { ...g, measuredOn: v }), 'Date measured *', { date: true })}
          {formInput(growthForm.weightKg, (v) => setGrowthForm((g) => g && { ...g, weightKg: v }), 'Weight (kg)', { numeric: true })}
          {formInput(growthForm.lengthCm, (v) => setGrowthForm((g) => g && { ...g, lengthCm: v }), 'Length or height (cm)', { numeric: true })}
          {formInput(growthForm.headCircumferenceCm, (v) => setGrowthForm((g) => g && { ...g, headCircumferenceCm: v }), 'Head circumference (cm)', { numeric: true })}
          {formInput(growthForm.notes, (v) => setGrowthForm((g) => g && { ...g, notes: v }), 'Notes')}
          <View style={{ gap: 8, marginTop: 4 }}>
            {button('Save measurement', saveGrowth, 'primary', !growthForm.measuredOn)}
            {button('Cancel', () => setGrowthForm(null), 'alt')}
          </View>
        </View>
      ) : canAdd ? (
        button('Add a measurement', () => setGrowthForm({ ...EMPTY_GROWTH, measuredOn: todayIso() }))
      ) : null}
      <GrowthChart
        entries={growthEntries}
        gender={profile?.gender || ''}
        dob={dobValid ? dob : ''}
        gestationalAgeWeeks={profile?.childProfile?.gestationalAgeWeeks}
      />
      <Text style={[styles.sub, { color: theme.muted }]}>
        The chart is a guide, not a diagnosis. Show these numbers at your child's well-child visit.
      </Text>
      {growthEntries.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>No measurements yet.</Text>}
      {growthEntries.map((g) => (
        <View key={g.id} style={[styles.doseCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.name, { color: theme.text }]}>{formatDisplayDate(g.measuredOn)}</Text>
          <Text style={[styles.sub, { color: theme.text }]}>
            {[g.weightKg != null && `${g.weightKg} kg`, g.lengthCm != null && `${g.lengthCm} cm`, g.headCircumferenceCm != null && `head ${g.headCircumferenceCm} cm`].filter(Boolean).join(' · ')}
          </Text>
          {g.notes ? <Text style={[styles.sub, { color: theme.muted }]}>{g.notes}</Text> : null}
          <Text style={[styles.sub, { color: theme.muted }]}>{pendingIds.has(g.id) ? 'Waiting to sync' : `Entered by ${g.source === 'clinic' ? 'a clinic' : 'a guardian'}`}</Text>
          {canAdd && g.source === 'caregiver' && (
            <TouchableOpacity onPress={() => removeGrowth(g)} style={styles.link}>
              <Text style={[styles.linkText, { color: '#b91c1c' }]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  const detailsTab = () => (
    <View style={{ gap: 4 }}>
      <Text style={[styles.groupTitle, { color: theme.text }]}>Identity</Text>
      {field('preferredName', 'Preferred name')}
      {field('gender', 'Sex recorded for clinical purposes', { placeholder: 'Female or Male' })}
      <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>Emergency information</Text>
      {field('bloodType', 'Blood group and Rhesus', { placeholder: 'e.g. O positive. Only if a lab confirmed it' })}
      {field('genotype', 'Genotype', { placeholder: 'e.g. AA' })}
      {field('allergies', 'Known allergies', { multiline: true })}
      {field('criticalAlerts', 'Critical medical alerts', { multiline: true, placeholder: 'Conditions or alerts a responder must know' })}
      {field('ecName', 'Emergency contact name')}
      {field('ecRelationship', 'Relationship')}
      {field('ecPhone', 'Phone', { numeric: true })}
      <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>Birth</Text>
      {field('birthRegistrationNo', 'Birth registration number')}
      {field('birthFacility', 'Place of birth')}
      {field('gestationalAgeWeeks', 'Gestational age (weeks)', { numeric: true })}
      {field('birthWeightKg', 'Birth weight (kg)', { numeric: true })}
      {field('birthLengthCm', 'Birth length (cm)', { numeric: true })}
      <View style={styles.fieldWrap}>
        {label('Delivery')}
        <View style={styles.chipRow}>
          {DELIVERY.map((d) => {
            const on = draft.deliveryMode === d;
            return (
              <TouchableOpacity
                key={d}
                accessibilityRole="button"
                onPress={() => setDraft((x) => ({ ...x, deliveryMode: on ? '' : d }))}
                style={[styles.pick, { borderColor: on ? '#082F67' : theme.border, backgroundColor: on ? '#082F67' : theme.surface }]}
              >
                <Text style={{ color: on ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text style={[styles.groupTitle, { color: theme.text, marginTop: 8 }]}>Home</Text>
      {field('address', 'Home address')}
      {field('community', 'Community')}
      {field('state', 'State')}
      {field('lga', 'Local government area')}
      {canAdd ? (
        <View style={{ marginTop: 8 }}>{button('Save details', saveDetails)}</View>
      ) : (
        <Text style={[styles.sub, { color: theme.muted }]}>The primary guardian has not given you permission to edit these details.</Text>
      )}
      {profile && memberId ? (
        <SchoolProfileCard
          memberId={memberId}
          profile={profile}
          rows={rows}
          canAdd={canAdd}
          toast={actions.showToast}
          onSaved={(saved) => {
            setBundle((b) => (b ? { ...b, profile: saved } : b));
            actions.applyChildProfile(memberId, saved);
          }}
        />
      ) : null}
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title={`${name}'s health profile`} onClose={close} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsScroll, { borderColor: theme.border }]} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setTab(t.key);
                  setVaxCode(null);
                }}
                style={[styles.tab, on && { borderBottomColor: '#082F67' }]}
              >
                <Text style={{ color: on ? '#082F67' : theme.muted, fontWeight: on ? '800' : '600', fontSize: 13 }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!error && <Text style={styles.error}>{error}</Text>}
          {syncBanner}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : !bundle ? (
            <View style={{ gap: 12 }}>{button('Try again', load, 'alt')}</View>
          ) : tab === 'overview' ? (
            overview()
          ) : tab === 'vaccines' ? (
            vaccines()
          ) : tab === 'growth' ? (
            growth()
          ) : tab === 'development' && memberId ? (
            <DevelopmentPanel memberId={memberId} dob={dob} canAdd={canAdd} toast={actions.showToast} />
          ) : tab === 'access' && memberId ? (
            <>
            <FacilityCodeCard memberId={memberId} childName={name} toast={actions.showToast} />
            <ChildReminderCard memberId={memberId} toast={actions.showToast} />
            <ChildAccessPanel
              memberId={memberId}
              childName={name}
              toast={actions.showToast}
              onFamilyChanged={() => {
                actions.reloadFamily().finally(() => actions.closeChildProfile());
              }}
            />
            </>
          ) : (
            detailsTab()
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  tabsScroll: { flexGrow: 0, borderBottomWidth: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  groupTitle: { fontSize: 14, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 19 },
  fine: { fontSize: 11, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  fieldWrap: { marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 46 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13, marginBottom: 10 },
  tileRow: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tileNum: { fontSize: 20, fontWeight: '800' },
  tileLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#fffbeb' },
  bannerText: { color: '#92400e', fontSize: 12, lineHeight: 17 },
  doseCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  doseHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  k: { fontSize: 13, flexShrink: 0 },
  v: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  wrId: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  qr: { padding: 8, backgroundColor: '#fff', borderRadius: 10 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
});
