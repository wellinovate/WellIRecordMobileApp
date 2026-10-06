import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { pharmacyService, type PharmacyOrder } from '../services/pharmacyService';
import type { WelliApp } from '../state/useWelliApp';

const PRIMARY = '#0EA5E9';
const STEPS = ['Prescription verified', 'Dispensed', 'Rider en route', 'Delivered'];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrderTrackingModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const isVisible = Boolean(state.showOrderTracking);

  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await pharmacyService.fetchOrders();
      setOrders(list);
      setExpandedId((prev) => prev ?? list.find((o) => o.step >= 0 && o.step < 4)?.id ?? null);
    } catch (err) {
      console.error('[OrderTrackingModal] load error:', err);
      setError('Could not load your orders. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) load();
  }, [isVisible, load]);

  if (!isVisible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={actions.closeOrderTracking}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="Orders & tracking" onClose={actions.closeOrderTracking} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          {loading && orders.length === 0 && <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />}
          {!!error && <Text style={[styles.note, { color: '#b91c1c' }]}>{error}</Text>}
          {!loading && !error && orders.length === 0 && (
            <Text style={[styles.note, { color: theme.muted }]}>
              No medication orders yet. Orders you place from the Care tab appear here.
            </Text>
          )}

          {orders.map((o) => {
            const rejected = o.step < 0;
            const open = expandedId === o.id;
            return (
              <View key={o.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandedId(open ? null : o.id)}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: theme.text }]}>
                        {o.medicationName}
                        {o.dosage ? ` ${o.dosage}` : ''}
                      </Text>
                      <Text style={[styles.sub, { color: theme.muted }]}>
                        Qty {o.quantity} · Ordered {formatDate(o.createdAt)}
                      </Text>
                    </View>
                    <Text style={[styles.status, { color: rejected ? '#b91c1c' : o.step === 4 ? '#15803d' : PRIMARY }]}>
                      {o.statusText}
                    </Text>
                  </View>
                </TouchableOpacity>

                {open && (
                  <View style={{ marginTop: 14 }}>
                    {rejected ? (
                      <Text style={[styles.sub, { color: '#b91c1c' }]}>
                        {o.rejectionReason || 'This order was not approved. Contact the pharmacy for details.'}
                      </Text>
                    ) : (
                      STEPS.map((label, i) => {
                        const done = o.step >= i + 1;
                        const current = o.step === i + 1;
                        return (
                          <View key={label} style={styles.stepRow}>
                            <View
                              style={[
                                styles.dot,
                                { backgroundColor: done ? PRIMARY : 'transparent', borderColor: done ? PRIMARY : theme.border },
                              ]}
                            />
                            <Text style={{ color: done ? theme.text : theme.muted, fontWeight: current ? '700' : '400', fontSize: 14 }}>
                              {label}
                            </Text>
                          </View>
                        );
                      })
                    )}
                    {o.step === 0 && (
                      <Text style={[styles.sub, { color: theme.muted, marginTop: 6 }]}>
                        A pharmacist reviews every order before it is dispensed.
                      </Text>
                    )}
                    {!!o.eta && o.step > 0 && o.step < 4 && (
                      <Text style={[styles.sub, { color: theme.muted, marginTop: 6 }]}>ETA: {o.eta}</Text>
                    )}
                    {!!o.deliveryAddress && (
                      <Text style={[styles.sub, { color: theme.muted, marginTop: 6 }]}>Deliver to: {o.deliveryAddress}</Text>
                    )}
                    {o.rider && (
                      <View style={[styles.rider, { borderColor: theme.border }]}>
                        <Text style={{ color: theme.text, fontSize: 14 }}>Rider: {o.rider.name}</Text>
                        {!!o.rider.phone && (
                          <TouchableOpacity onPress={() => Linking.openURL(`tel:${o.rider!.phone}`)}>
                            <Text style={{ color: PRIMARY, fontWeight: '600', fontSize: 14 }}>Call {o.rider.phone}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  note: { fontSize: 14, textAlign: 'center', marginTop: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', maxWidth: 140, textAlign: 'right' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  rider: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 4 },
});
