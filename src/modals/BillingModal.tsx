import { ModalHeader } from '../components/ModalHeader';
import { formatNaira, invoiceTotal } from '../utils/currency';
import type { WelliApp } from '../state/useWelliApp';

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
}

export function BillingModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showBilling) return null;

  const outstanding = state.invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + (invoiceTotal(inv.items) - inv.hmoCovered), 0);
  const paid = state.invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + invoiceTotal(inv.items), 0);
  const hmoCovered = state.invoices.reduce((sum, inv) => sum + inv.hmoCovered, 0);

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Billing & Payments" onClose={actions.closeBilling} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 18 }}>Invoices, receipts, and balances from your providers.</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <StatCard label="Outstanding" value={formatNaira(outstanding)} sub="Across unpaid and part-paid invoices." />
          <StatCard label="Paid" value={formatNaira(paid)} sub="Total settled across all invoices." />
          <StatCard label="HMO Covered" value={formatNaira(hmoCovered)} sub="Contributions applied by your insurer." />
        </div>

        <div className="section-label" style={{ color: '#0f172a', marginBottom: 4 }}>
          Your Invoices
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Tap an invoice to see the full breakdown.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.invoices.map((inv) => {
            const total = invoiceTotal(inv.items);
            const patientPortion = total - inv.hmoCovered;
            const isPaid = inv.status === 'paid';
            return (
              <div
                key={inv.id}
                onClick={() => actions.openInvoiceDetail(inv.id)}
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{inv.id}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: isPaid ? 'rgba(16,185,129,.14)' : '#fef3c7',
                      color: isPaid ? '#10b981' : '#92400e',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPaid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{inv.provider}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {inv.date} &middot; {inv.items.length} items
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{formatNaira(total)}</div>
                    {!isPaid && <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>You pay: {formatNaira(patientPortion)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
