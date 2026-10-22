import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';
import type { HealthRecord, PrescriptionItem } from '../data/types';

const NONE = new Set(['', 'na', 'n/a', 'none', 'nil', 'no known allergies', 'none on file']);
const split = (v?: string) =>
  String(v ?? '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s && !NONE.has(s.toLowerCase()));

const byDateDesc = (a: { date?: string }, b: { date?: string }) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0);

const RECORD_GROUPS: { type: HealthRecord['type']; title: string }[] = [
  { type: 'Clinical Note', title: 'Visits and clinical notes' },
  { type: 'Lab Result', title: 'Lab results' },
  { type: 'Imaging', title: 'Imaging' },
  { type: 'Immunization', title: 'Immunizations' },
];

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const Empty = ({ text }: { text: string }) => <Text style={styles.empty}>{text}</Text>;

function Chips({ items }: { items: string[] }) {
  return (
    <View style={styles.chipRow}>
      {items.map((t) => (
        <View key={t} style={styles.chip}>
          <Text style={styles.chipText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function MedicineRow({ rx }: { rx: PrescriptionItem }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{rx.medicationName}</Text>
      <Text style={styles.rowSub}>{[rx.dosage, rx.frequency].filter(Boolean).join(' · ') || 'No dose on file'}</Text>
      <Text style={styles.rowMeta}>
        {[rx.prescriber && `Prescribed by ${rx.prescriber}`, rx.prescribedDate].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

// Everything on file for the person whose profile is open: allergies, conditions, medicines, records and recent vitals.
// Hooks run before the early return, as with every modal here.
export function HealthHistoryModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showHealthHistory) return null;

  const member = state.familyMembers.find((f) => f.id === state.activeFamilyId) ?? state.familyMembers[0];
  const owner = state.activeFamilyId;
  const allergies = split(member?.allergies);
  const conditions = split(member?.conditions);
  const medicines = state.prescriptions.filter((rx) => rx.ownerId === owner).sort((a, b) => byDateDesc({ date: a.prescribedDate }, { date: b.prescribedDate }));
  const records = state.recordsList.filter((r) => r.ownerId === owner);
  const vitals = state.vitalsLogs.filter((v) => v.ownerId === owner).slice(0, 6);
  const nothing = !allergies.length && !conditions.length && !medicines.length && !records.length && !vitals.length;

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={actions.closeHealthHistory}>
      <SafeAreaView style={styles.container}>
        <ModalHeader title="Health history" onClose={actions.closeHealthHistory} />
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.intro}>
            {member?.name ? `${member.name}'s` : 'Your'} allergies, conditions, medicines, records and vitals in one place. Only what is saved in WelliRecord appears here.
          </Text>

          <Section title="Allergies" count={allergies.length}>
            {allergies.length ? <Chips items={allergies} /> : <Empty text="None on file." />}
            <TouchableOpacity onPress={actions.editHealthInfo} style={styles.link}>
              <Text style={styles.linkText}>Edit allergies and conditions</Text>
            </TouchableOpacity>
          </Section>

          <Section title="Medical conditions" count={conditions.length}>
            {conditions.length ? <Chips items={conditions} /> : <Empty text="None on file." />}
          </Section>

          <Section title="Medicines" count={medicines.length}>
            {medicines.length ? medicines.map((rx) => <MedicineRow key={rx.id} rx={rx} />) : <Empty text="No medicines on file." />}
          </Section>

          {RECORD_GROUPS.map((g) => {
            const items = records.filter((r) => r.type === g.type).sort(byDateDesc);
            return (
              <Section key={g.type} title={g.title} count={items.length}>
                {items.length ? (
                  items.map((r) => (
                    <TouchableOpacity key={r.id} style={styles.row} onPress={() => actions.openRecordFromHistory(r.id)} activeOpacity={0.7}>
                      <Text style={styles.rowTitle}>{r.title}</Text>
                      <Text style={styles.rowMeta}>{[r.date, r.provider].filter(Boolean).join(' · ')}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Empty text="Nothing on file." />
                )}
              </Section>
            );
          })}

          <Section title="Recent vitals" count={vitals.length}>
            {vitals.length ? (
              vitals.map((v) => (
                <View key={v.id} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {v.primaryValue}
                    {v.secondaryValue ? `/${v.secondaryValue}` : ''} {v.unit}
                  </Text>
                  <Text style={styles.rowMeta}>{[v.type.toUpperCase(), v.timestamp].filter(Boolean).join(' · ')}</Text>
                </View>
              ))
            ) : (
              <Empty text="No readings logged." />
            )}
          </Section>

          {nothing ? <Text style={styles.empty}>Add records or details and they will show here.</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { padding: 20, paddingBottom: 48 },
  intro: { fontSize: 13.5, color: '#64748B', lineHeight: 19, marginBottom: 12 },
  section: { marginTop: 18, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  count: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  empty: { fontSize: 13.5, color: '#94A3B8' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E0ECFF' },
  chipText: { fontSize: 13.5, fontWeight: '600', color: '#041E42' },
  row: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: '#0F172A' },
  rowSub: { fontSize: 13, color: '#475569', marginTop: 2 },
  rowMeta: { fontSize: 12.5, color: '#94A3B8', marginTop: 2 },
  link: { marginTop: 12 },
  linkText: { fontSize: 13.5, fontWeight: '700', color: '#0369A1' },
});
