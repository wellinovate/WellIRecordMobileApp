import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import { formatNaira, invoiceTotal } from '../utils/currency';
import type { WelliApp } from '../state/useWelliApp';

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

export function BillingModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showBilling) return null;

  const outstanding = state.invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + (invoiceTotal(inv.items) - inv.hmoCovered), 0);
  const paid = state.invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + invoiceTotal(inv.items), 0);
  const hmoCovered = state.invoices.reduce((sum, inv) => sum + inv.hmoCovered, 0);

  return (
    <Modal
      visible={state.showBilling}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeBilling}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Billing & Payments"
          onClose={actions.closeBilling}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <Text style={styles.headerSubtitle}>
            Invoices, receipts, and balances from your providers.
          </Text>

          <View style={styles.statCardsRow}>
            <StatCard
              label="Outstanding"
              value={formatNaira(outstanding)}
              sub="Across unpaid and part-paid invoices."
            />
            <StatCard
              label="Paid"
              value={formatNaira(paid)}
              sub="Total settled across all invoices."
            />
            <StatCard
              label="HMO Covered"
              value={formatNaira(hmoCovered)}
              sub="Contributions applied by your insurer."
            />
          </View>

          <Text style={styles.sectionTitle}>Your Invoices</Text>
          <Text style={styles.sectionSub}>Tap an invoice to see the full breakdown.</Text>

          <View style={styles.invoiceList}>
            {state.invoices.map((inv) => {
              const total = invoiceTotal(inv.items);
              const patientPortion = total - inv.hmoCovered;
              const isPaid = inv.status === 'paid';

              return (
                <TouchableOpacity
                  key={inv.id}
                  activeOpacity={0.7}
                  onPress={() => actions.openInvoiceDetail(inv.id)}
                  style={styles.invoiceCard}
                >
                  <View style={styles.invoiceTop}>
                    <Text style={styles.invoiceId}>{inv.id}</Text>
                    <View
                      style={[
                        styles.paidBadge,
                        {
                          backgroundColor: isPaid
                            ? 'rgba(16,185,129,0.14)'
                            : '#fef3c7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.paidBadgeText,
                          { color: isPaid ? '#10b981' : '#92400e' },
                        ]}
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoiceBottom}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.providerName}>{inv.provider}</Text>
                      <Text style={styles.invoiceMeta}>
                        {inv.date} · {inv.items.length} items
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.invoiceTotal}>{formatNaira(total)}</Text>
                      {!isPaid && (
                        <Text style={styles.youPay}>
                          You pay: {formatNaira(patientPortion)}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 18,
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statSub: {
    fontSize: 9.5,
    color: '#64748b',
    lineHeight: 13,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  invoiceList: {
    gap: 10,
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
  },
  invoiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  invoiceId: {
    fontSize: 11,
    color: '#94a3b8',
  },
  paidBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  paidBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  invoiceBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  providerName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  invoiceMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  invoiceTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  youPay: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 2,
  },
});
