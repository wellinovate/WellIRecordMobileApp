import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { formatNaira } from '../utils/currency';
import { hapticFeedback } from '../utils/haptics';
import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';

export function PrescriptionRefillModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, prescriptions, family } = app;
  const rx = prescriptions.find((p) => p.id === state.showRefillModal);
  const patient = family.find((f) => f.id === rx?.ownerId) || family[0];
  const [address, setAddress] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!state.showRefillModal || !rx) return null;

  const deliveryAddress = address ?? (rx.deliveryAddress || patient?.address || '');
  const noRefillsLeft = rx.refillsRemaining <= 0;
  const canSubmit = !submitting && !noRefillsLeft && deliveryAddress.trim().length > 0;

  const submit = async () => {
    hapticFeedback.light();
    setSubmitting(true);
    const ok = await actions.requestRefill({ prescriptionId: rx.id, deliveryAddress: deliveryAddress.trim(), notes: notes.trim() || undefined });
    setSubmitting(false);
    if (ok) {
      setAddress(null);
      setNotes('');
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={actions.closeRefillModal}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Request a refill" onClose={actions.closeRefillModal} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.name, { color: theme.text }]}>{rx.medicationName}</Text>
            {!!rx.dosage && <Text style={[styles.sub, { color: theme.muted }]}>{rx.dosage}</Text>}
            {!!rx.frequency && <Text style={[styles.sub, { color: theme.muted }]}>{rx.frequency}</Text>}
            {!!rx.prescriber && <Text style={[styles.sub, { color: theme.muted }]}>Prescribed by {rx.prescriber}</Text>}
            <Text style={[styles.sub, { color: theme.text, marginTop: 6 }]}>
              Refills left: {rx.refillsRemaining} of {rx.refillsTotal}
            </Text>
            {rx.patientCoPayNaira > 0 && (
              <Text style={[styles.sub, { color: theme.muted }]}>Last quoted price: {formatNaira(rx.patientCoPayNaira)}</Text>
            )}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>DELIVERY ADDRESS</Text>
          <TextInput
            value={deliveryAddress}
            onChangeText={setAddress}
            placeholder="Where should the pharmacy deliver?"
            placeholderTextColor={theme.mutedLight}
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          />

          <Text style={[styles.label, { color: theme.muted }]}>NOTE FOR THE PHARMACIST (OPTIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the pharmacist should know"
            placeholderTextColor={theme.mutedLight}
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          />

          <Text style={[styles.sub, { color: theme.muted, marginTop: 12 }]}>
            A pharmacist reviews every refill. Price and delivery time are confirmed after review. A refill is only counted once it is approved.
          </Text>
          {noRefillsLeft && (
            <Text style={[styles.sub, { color: '#b91c1c', marginTop: 8 }]}>
              No refills left. Ask your prescriber for a new prescription.
            </Text>
          )}

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={submit}
            accessibilityRole="button"
            style={[styles.btn, { backgroundColor: canSubmit ? '#082F67' : '#cbd5e1' }]}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send refill request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  name: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 48 },
  btn: { marginTop: 16, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
