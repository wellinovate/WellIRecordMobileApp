import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import { useTheme } from '../theme/ThemeContext';
import { childHealthService, type ChildProfileBundle } from '../services/childHealthService';
import { ageLabel, formatDisplayDate, type DoseRow } from '../utils/immunization';
import type { SchoolProfile } from '../data/types';

type Include = NonNullable<SchoolProfile['include']>;
const INCLUDE_OPTIONS: { key: keyof Include; label: string; hint: string }[] = [
  { key: 'emergencyContact', label: 'Emergency contact', hint: 'Name, relationship and phone' },
  { key: 'allergies', label: 'Allergies', hint: 'As recorded in the profile' },
  { key: 'conditions', label: 'Critical medical alerts', hint: 'Conditions a teacher must know' },
  { key: 'immunizations', label: 'Immunization status', hint: 'Doses given, marked verified or reported' },
];

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Builds the lines of the summary. Only what the guardian ticked is included. */
export function schoolSummary(profile: ChildProfileBundle['profile'], school: SchoolProfile, rows: DoseRow[]): { title: string; lines: string[]; included: string[] } {
  const inc = school.include || {};
  const d = profile.childProfile || {};
  const lines: string[] = [];
  const included: string[] = [];
  const dob = profile.dateOfBirth;
  lines.push(`Name: ${profile.fullName}`);
  if (dob) lines.push(`Date of birth: ${formatDisplayDate(dob)} (${ageLabel(dob)})`);
  if (school.name) lines.push(`School: ${school.name}${school.className ? `, ${school.className}` : ''}`);
  if (inc.emergencyContact) {
    const ec = d.emergencyContact;
    const text = [ec?.name, ec?.relationship && `(${ec.relationship})`, ec?.phone].filter(Boolean).join(' ');
    lines.push(`Emergency contact: ${text || 'Not recorded'}`);
    included.push('emergency contact');
  }
  if (inc.allergies) {
    lines.push(`Allergies: ${profile.allergies || 'None recorded'}`);
    included.push('allergies');
  }
  if (inc.conditions) {
    lines.push(`Critical medical alerts: ${d.criticalAlerts || 'None recorded'}`);
    included.push('medical alerts');
  }
  if (school.healthNotes) lines.push(`Notes from the guardian: ${school.healthNotes}`);
  if (inc.immunizations) {
    const given = rows.filter((r) => r.record);
    lines.push(
      given.length
        ? `Immunizations: ${given.map((r) => `${r.dose.vaccine}${r.dose.doseNumber ? ` dose ${r.dose.doseNumber}` : ''} ${formatDisplayDate(r.record!.administeredDate)}${r.record!.verification === 'provider_verified' ? ' (verified by a clinic)' : ' (reported by the guardian)'}`).join('; ')}`
        : 'Immunizations: none recorded',
    );
    lines.push('Doses marked "reported" have not been confirmed by a clinic.');
    included.push('immunizations');
  }
  return { title: `School health summary: ${profile.fullName}`, lines, included };
}

export function SchoolProfileCard({
  memberId,
  profile,
  rows,
  canAdd,
  onSaved,
  toast,
}: {
  memberId: string;
  profile: ChildProfileBundle['profile'];
  rows: DoseRow[];
  canAdd: boolean;
  onSaved: (profile: ChildProfileBundle['profile']) => void;
  toast: (message: string) => void;
}) {
  const theme = useTheme();
  const saved = profile.childProfile?.school || {};
  const [draft, setDraft] = useState<SchoolProfile>({ ...saved, include: { ...(saved.include || {}) } });
  const [busy, setBusy] = useState(false);

  const set = (key: keyof SchoolProfile, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await childHealthService.updateProfile(memberId, { school: draft }));
      toast('School details saved');
    } catch (err: any) {
      toast(err?.message || 'Could not save the school details.');
    } finally {
      setBusy(false);
    }
  };

  const summary = schoolSummary(profile, draft, rows);

  // The text goes to the share sheet or the print dialog, so the guardian chooses where it goes.
  const share = async () => {
    try {
      const res = await Share.share({ title: summary.title, message: [summary.title, ...summary.lines].join('\n') });
      if (res.action !== Share.dismissedAction) childHealthService.logSchoolShared(memberId, summary.included);
    } catch {
      toast('Could not open the share sheet.');
    }
  };

  const print = async () => {
    try {
      const html = `<html><body style="font-family:sans-serif;padding:24px"><h2>${esc(summary.title)}</h2>${summary.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p style="color:#64748b;font-size:12px">Shared by the guardian on ${esc(new Date().toLocaleDateString('en-GB'))}. Contact the guardian with questions.</p></body></html>`;
      await Print.printAsync({ html });
      childHealthService.logSchoolShared(memberId, summary.included);
    } catch {
      /* the person closed the print dialog */
    }
  };

  const field = (key: keyof SchoolProfile, label: string, multiline = false) => (
    <View style={{ marginBottom: 10 }} key={key}>
      <Text style={[styles.label, { color: theme.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={(draft[key] as string) || ''}
        onChangeText={(v) => set(key, v)}
        editable={canAdd}
        multiline={multiline}
        placeholderTextColor={theme.mutedLight}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
      />
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.heading, { color: theme.text }]}>School health profile</Text>
      <Text style={[styles.sub, { color: theme.muted }]}>
        Nothing is sent to the school automatically. You choose what goes into a summary, then share or print it yourself.
      </Text>
      <View style={{ height: 10 }} />
      {field('name', 'School')}
      {field('className', 'Class')}
      {field('teacherName', 'Class teacher or school nurse')}
      {field('contactPhone', 'School phone')}
      {field('healthNotes', 'Notes for the school (for example, inhaler in school bag)', true)}
      <Text style={[styles.label, { color: theme.muted }]}>INCLUDE IN THE SUMMARY</Text>
      {INCLUDE_OPTIONS.map((o) => (
        <View key={o.key} style={styles.row}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: theme.text }]}>{o.label}</Text>
            <Text style={[styles.fine, { color: theme.muted }]}>{o.hint}</Text>
          </View>
          <Switch
            value={Boolean(draft.include?.[o.key])}
            disabled={!canAdd}
            onValueChange={(v) => setDraft((d) => ({ ...d, include: { ...(d.include || {}), [o.key]: v } }))}
            accessibilityLabel={`Include ${o.label}`}
          />
        </View>
      ))}
      <View style={{ gap: 8, marginTop: 10 }}>
        {canAdd && (
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={[styles.btn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save school details</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={share} style={styles.btnAlt}><Text style={styles.btnAltText}>Share summary</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={print} style={styles.btnAlt}><Text style={styles.btnAltText}>Print or save as PDF</Text></TouchableOpacity>
      </View>
      <Text style={[styles.fine, { color: theme.mutedLight, marginTop: 8 }]}>The summary uses what is in the form now, including changes you have not saved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 13, lineHeight: 19 },
  fine: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 46 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
});
