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
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

import type { HmoClaimStep } from '../data/types';

export function InvoiceDetailModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const invoice = state.invoices.find(
    (inv) => inv.id === state.showInvoiceDetail
  );
  if (!invoice) return null;

  const total = invoiceTotal(invoice.items);
  const patientPortion = invoice.patientCoPay ?? (total - invoice.hmoCovered);
  const isPaid = invoice.status === 'paid';

  const defaultClaimSteps: HmoClaimStep[] = [
    { title: 'Claim Submitted', timestamp: `${invoice.date} · 09:15 AM`, status: 'completed', note: 'Invoice itemized & transmitted by provider' },
    { title: 'HMO Pre-Auth Verified', timestamp: `${invoice.date} · 09:30 AM`, status: 'completed', note: `${invoice.hmoProvider ?? 'HMO'} policy active · 80% tariff applied` },
    { title: 'Claim Approved', timestamp: `${invoice.date} · 10:12 AM`, status: 'completed', note: `HMO covered ${formatNaira(invoice.hmoCovered)}` },
    { title: isPaid ? 'Reconciled & Settled' : 'Awaiting Patient Co-Pay', timestamp: isPaid ? 'Settled' : 'Pending', status: isPaid ? 'completed' : 'in_progress', note: isPaid ? 'All balances settled via Card / Bank Transfer' : `Patient co-pay ${formatNaira(patientPortion)} due` },
  ];

  const steps = invoice.claimSteps ?? defaultClaimSteps;

  const handleSettle = () => {
    hapticFeedback.success();
    actions.payInvoice(invoice.id);
  };

  return (
    <Modal
      visible={!!state.showInvoiceDetail}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeInvoiceDetail}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="HMO Reconciled Invoice"
          onClose={actions.closeInvoiceDetail}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Provider & ID Card */}
          <View style={styles.infoCard}>
            <View style={styles.idRow}>
              <Text style={styles.invoiceId}>{invoice.id}</Text>
              <View style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                <Text style={[styles.statusBadgeText, isPaid ? styles.statusTextPaid : styles.statusTextPending]}>
                  {isPaid ? '✓ RECONCILED & PAID' : '● AWAITING CO-PAY'}
                </Text>
              </View>
            </View>
            <Text style={styles.providerName}>{invoice.provider}</Text>
            <Text style={styles.dateText}>{invoice.date} · Insurance: {invoice.hmoProvider ?? 'Private HMO'}</Text>
          </View>

          {/* 4-Step Claim Lifecycle Tracker */}
          <Text style={styles.sectionTitle}>HMO Claim Approval Timeline</Text>
          <View style={styles.timelineCard}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const isDone = step.status === 'completed';
              return (
                <View key={step.title} style={styles.timelineStepRow}>
                  <View style={styles.timelineIconCol}>
                    <View style={[styles.stepCircle, isDone ? styles.stepCircleDone : styles.stepCircleActive]}>
                      <Text style={styles.stepCircleText}>{isDone ? '✓' : idx + 1}</Text>
                    </View>
                    {!isLast && <View style={[styles.stepConnector, isDone && styles.stepConnectorDone]} />}
                  </View>
                  <View style={styles.stepContentCol}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={[styles.stepTitle, isDone && styles.stepTitleDone]}>{step.title}</Text>
                      <Text style={styles.stepTimestamp}>{step.timestamp}</Text>
                    </View>
                    <Text style={styles.stepNote}>{step.note}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Itemized Services Breakdown */}
          <Text style={styles.sectionTitle}>Itemized Services</Text>
          <View style={styles.itemsBox}>
            {invoice.items.map((item, i) => (
              <View
                key={item.label}
                style={[
                  styles.itemRow,
                  {
                    borderBottomWidth: i === invoice.items.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemAmount}>{formatNaira(item.amount)}</Text>
              </View>
            ))}
          </View>

          {/* Financial Breakdown (Naira) */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Hospital Bill</Text>
              <Text style={styles.summaryValue}>{formatNaira(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>HMO 80% Tariff Coverage</Text>
              <Text style={styles.hmoCoveredValue}>
                -{formatNaira(invoice.hmoCovered)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.youPayLabel}>
                {isPaid ? 'Patient Co-Pay Settled' : 'Patient 20% Co-Pay Due'}
              </Text>
              <Text
                style={[
                  styles.youPayValue,
                  { color: isPaid ? '#10b981' : '#041E42' },
                ]}
              >
                {formatNaira(patientPortion)}
              </Text>
            </View>
          </View>

          {/* Action Button */}
          {!isPaid ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSettle}
              style={styles.payBtn}
            >
              <Text style={styles.payBtnText}>Settle Co-Pay ({formatNaira(patientPortion)}) ›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.settledBanner}>
              <Text style={styles.settledBannerText}>✓ Invoice Fully Reconciled with HMO</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusBadgePaid: {
    backgroundColor: '#ecfdf5',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusTextPaid: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#b45309',
  },
  providerName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  dateText: {
    fontSize: 12.5,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  timelineStepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineIconCol: {
    alignItems: 'center',
    width: 24,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  stepCircleDone: {
    backgroundColor: '#10b981',
  },
  stepCircleActive: {
    backgroundColor: '#f59e0b',
  },
  stepCircleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  stepConnectorDone: {
    backgroundColor: '#10b981',
  },
  stepContentCol: {
    flex: 1,
    paddingBottom: 16,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  stepTitleDone: {
    color: '#0f172a',
  },
  stepTimestamp: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  stepNote: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16,
  },
  itemsBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: '#f1f5f9',
  },
  itemLabel: {
    fontSize: 13,
    color: '#334155',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  hmoCoveredValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  youPayLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  youPayValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  payBtn: {
    backgroundColor: '#041E42',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  settledBanner: {
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  settledBannerText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
});
