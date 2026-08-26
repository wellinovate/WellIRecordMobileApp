import { ModalHeader } from '../components/ModalHeader';
import { formatNaira, invoiceTotal } from '../utils/currency';
import type { WelliApp } from '../state/useWelliApp';

export function InvoiceDetailModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const invoice = state.invoices.find((inv) => inv.id === state.showInvoiceDetail);
  if (!invoice) return null;

  const total = invoiceTotal(invoice.items);
  const patientPortion = total - invoice.hmoCovered;
  const isPaid = invoice.status === 'paid';

  return (
    <div className="overlay-fullscreen" style={{ zIndex: 50 }}>
      <ModalHeader title="Invoice Details" onClose={actions.closeInvoiceDetail} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
        <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', marginBottom: 6 }}>{invoice.id}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{invoice.provider}</div>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>{invoice.date}</div>
        </div>

        <div className="section-label" style={{ color: '#0f172a', marginBottom: 10 }}>
          Line Items
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          {invoice.items.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: i === invoice.items.length - 1 ? 'none' : '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: 13.5, color: '#334155' }}>{item.label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{formatNaira(item.amount)}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{formatNaira(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>HMO Covered</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>-{formatNaira(invoice.hmoCovered)}</span>
          </div>
          <div style={{ height: 1, background: '#e2e8f0', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{isPaid ? 'Paid' : 'You Pay'}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: isPaid ? '#10b981' : '#0f172a' }}>{formatNaira(patientPortion)}</span>
          </div>
        </div>

        {!isPaid && (
          <button
            onClick={() => actions.markInvoicePaid(invoice.id)}
            style={{ width: '100%', background: '#041E42', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Mark as Paid
          </button>
        )}
      </div>
    </div>
  );
}
