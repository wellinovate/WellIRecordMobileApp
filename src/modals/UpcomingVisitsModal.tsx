import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';
import type { AppointmentItem } from '../services/careService';
import { formatMinor } from '../services/wellipayService';

const STATUS_LABEL: Record<string, string> = {
  requested: 'Awaiting confirmation',
  awaiting_payment: 'Awaiting payment',
  awaiting_hmo: 'Awaiting HMO confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  no_show: 'Missed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  requested: '#b45309',
  awaiting_payment: '#b45309',
  awaiting_hmo: '#b45309',
  confirmed: '#15803d',
  checked_in: '#0369a1',
  completed: '#475569',
  no_show: '#b91c1c',
  cancelled: '#64748b',
};

export function formatVisitDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function isToday(iso: string) {
  const lagos = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === lagos;
}

const ACTIVE = ['requested', 'awaiting_payment', 'awaiting_hmo', 'confirmed'];

/** A virtual visit booked from the provider's hours can be joined from 10 minutes before the start. */
function canJoinNow(a: AppointmentItem) {
  if (a.visitType !== 'video' || a.status !== 'confirmed') return false;
  if (a.startsAt) {
    const start = new Date(a.startsAt).getTime();
    return Date.now() >= start - 10 * 60 * 1000 && Date.now() <= start + 90 * 60 * 1000;
  }
  return isToday(a.scheduledFor);
}

export function isUpcoming(a: AppointmentItem) {
  if (!ACTIVE.includes(a.status)) return false;
  const t = new Date(a.scheduledFor).getTime();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return !Number.isNaN(t) && t >= startOfToday.getTime() - 24 * 60 * 60 * 1000;
}

export function UpcomingVisitsModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  if (!state.showUpcomingVisits) return null;

  const upcoming = state.appointments.filter(isUpcoming);
  const past = state.appointments.filter((a) => !isUpcoming(a)).reverse();

  const confirmCancel = (a: AppointmentItem) => {
    Alert.alert('Cancel this visit?', `${a.facilityName}, ${formatVisitDate(a.scheduledFor)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel visit', style: 'destructive', onPress: () => actions.cancelAppointment(a.id) },
    ]);
  };

  const renderItem = (a: AppointmentItem, canCancel: boolean) => (
    <View key={`${a.source}-${a.id}`} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: theme.text }]}>{a.facilityName}</Text>
        <Text style={[styles.status, { color: STATUS_COLOR[a.status] || theme.muted }]}>
          {STATUS_LABEL[a.status] || a.status}
        </Text>
      </View>
      <Text style={[styles.sub, { color: theme.muted }]}>
        {formatVisitDate(a.scheduledFor)}
        {a.timeSlot ? ` · ${a.timeSlot}` : ''}
      </Text>
      {!!a.reason && <Text style={[styles.sub, { color: theme.muted }]}>Reason: {a.reason}</Text>}
      {a.visitType === 'video' && (
        <Text style={[styles.sub, { color: theme.muted }]}>Video visit</Text>
      )}
      {!!a.bookingRef && <Text style={[styles.sub, { color: theme.muted }]}>Reference {a.bookingRef}</Text>}
      {a.feeMinor != null && (
        <Text style={[styles.sub, { color: theme.muted }]}>
          {formatMinor(a.feeMinor, a.currency || 'NGN')} ·{' '}
          {a.paymentStatus === 'paid'
            ? 'paid online'
            : a.paymentStatus === 'pay_at_visit'
              ? 'pay at the visit'
              : a.paymentStatus === 'awaiting_hmo'
                ? 'waiting for HMO confirmation'
                : a.paymentStatus === 'pending'
                  ? 'waiting for payment'
                  : a.paymentStatus === 'hmo_approved'
                    ? 'covered by your HMO'
                    : a.paymentStatus === 'refund_due'
                      ? 'refund being reviewed'
                      : ''}
        </Text>
      )}
      {!!a.visitSummary && (
        <View style={[styles.summary, { borderColor: theme.border }]}>
          {!!a.visitSummary.diagnosis && (
            <Text style={[styles.sub, { color: theme.text, fontWeight: '700' }]}>{a.visitSummary.diagnosis}</Text>
          )}
          {!!a.visitSummary.notes && <Text style={[styles.sub, { color: theme.muted }]}>{a.visitSummary.notes}</Text>}
          {!!a.visitSummary.authoredBy && (
            <Text style={[styles.sub, { color: theme.muted }]}>By {a.visitSummary.authoredBy}</Text>
          )}
          <Text style={[styles.sub, { color: theme.muted }]}>Also saved in your records.</Text>
        </View>
      )}
      {canJoinNow(a) && (
        <TouchableOpacity
          onPress={() => actions.joinVideoVisit({ id: a.id, facilityName: a.facilityName })}
          disabled={state.joiningVisitId === a.id}
          style={styles.joinBtn}
          accessibilityRole="button"
        >
          <Text style={styles.joinText}>{state.joiningVisitId === a.id ? 'Connecting…' : 'Join video visit'}</Text>
        </TouchableOpacity>
      )}
      {canCancel && ACTIVE.includes(a.status) && (
        <TouchableOpacity onPress={() => confirmCancel(a)} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel visit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={actions.closeUpcomingVisits}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Upcoming visits" onClose={actions.closeUpcomingVisits} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: theme.muted }]}>UPCOMING</Text>
          {upcoming.length === 0 ? (
            <Text style={[styles.sub, { color: theme.muted }]}>No upcoming visits. Book one from the Care tab.</Text>
          ) : (
            upcoming.map((a) => renderItem(a, true))
          )}
          {past.length > 0 && (
            <>
              <Text style={[styles.heading, { color: theme.muted, marginTop: 16 }]}>PAST AND CANCELLED</Text>
              {past.map((a) => renderItem(a, false))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  heading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  status: { fontSize: 12, fontWeight: '700' },
  sub: { fontSize: 13 },
  summary: { marginTop: 6, borderTopWidth: 1, paddingTop: 8, gap: 2 },
  joinBtn: { marginTop: 8, minHeight: 44, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { marginTop: 8, alignSelf: 'flex-start' },
  cancelText: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },
});
