import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useSignIn, useSignUp } from '@clerk/expo';
import { ModalHeader } from '../components/ModalHeader';
import {
  clearWellipaySession,
  formatMinor,
  isWellipayConfigured,
  WellipayError,
  wellipayService,
  type WellipayCard,
  type WellipayInvoice,
  type WellipayTransaction,
  type WellipayWallet,
} from '../services/wellipayService';
import type { WelliApp } from '../state/useWelliApp';

type Stage = 'loading' | 'unavailable' | 'signin' | 'link' | 'ready';
type Tab = 'bills' | 'wallet' | 'history';

const NAVY = '#082F67';

function clerkMessage(err: any, fallback: string): string {
  return err?.longMessage || err?.errors?.[0]?.longMessage || err?.message || fallback;
}

function nairaToMinor(text: string): number | null {
  const value = Number(text.replace(/[,\s₦]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function WellipaySignIn() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const value = email.trim().toLowerCase();
    if (!value.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      const created = await signIn.create({ identifier: value });
      if (!created.error) {
        const sent = await signIn.emailCode.sendCode();
        if (sent.error) throw sent.error;
        setMode('signin');
      } else if (created.error.code === 'form_identifier_not_found') {
        const made = await signUp.create({ emailAddress: value });
        if (made.error) throw made.error;
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) throw sent.error;
        setMode('signup');
      } else {
        throw created.error;
      }
      setStep('code');
    } catch (err) {
      setError(clerkMessage(err, 'Could not send the code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (!signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const checked = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (checked.error) throw checked.error;
        if (signIn.status === 'complete') {
          const done = await signIn.finalize();
          if (done.error) throw done.error;
        } else {
          setError('Sign-in needs another step that this app does not support yet.');
        }
      } else {
        const checked = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (checked.error) throw checked.error;
        if (signUp.status === 'complete') {
          const done = await signUp.finalize();
          if (done.error) throw done.error;
        } else {
          setError('Your WelliPay profile needs more details that this app does not collect yet.');
        }
      }
    } catch (err) {
      setError(clerkMessage(err, 'That code did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sign in to WelliPay</Text>
      <Text style={styles.muted}>
        WelliPay keeps your bills and payments. We send a code to your email to confirm it is you.
      </Text>
      {step === 'email' ? (
        <>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <PrimaryButton label="Email me a code" busy={busy} onPress={sendCode} />
        </>
      ) : (
        <>
          <Text style={styles.muted}>Code sent to {email.trim().toLowerCase()}.</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />
          <PrimaryButton label="Confirm" busy={busy} onPress={verify} />
          <TouchableOpacity onPress={() => setStep('email')} style={styles.linkButton}>
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={onPress} style={[styles.primary, busy && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function BillingModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const visible = Boolean(state.showBilling);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [stage, setStage] = useState<Stage>('loading');
  const [tab, setTab] = useState<Tab>('bills');
  const [token, setToken] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<WellipayInvoice[]>([]);
  const [transactions, setTransactions] = useState<WellipayTransaction[]>([]);
  const [wallet, setWallet] = useState<WellipayWallet | null>(null);
  const [cards, setCards] = useState<WellipayCard[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [linkRef, setLinkRef] = useState('');
  const [linkAmount, setLinkAmount] = useState('');
  const [linking, setLinking] = useState(false);

  const [emailFor, setEmailFor] = useState<WellipayInvoice | null>(null);
  const [payEmail, setPayEmail] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');

  const clerkToken = useCallback(() => getToken(), [getToken]);

  const loadAll = useCallback(async (t: string) => {
    const [inv, tx, w, c] = await Promise.all([
      wellipayService.listInvoices(t),
      wellipayService.listTransactions(t),
      wellipayService.getWallet(t),
      wellipayService.listCards(t),
    ]);
    setInvoices(inv);
    setTransactions(tx);
    setWallet(w);
    setCards(c);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    (async () => {
      if (!isWellipayConfigured) {
        setStage('unavailable');
        return;
      }
      if (!isLoaded) return;
      if (!isSignedIn) {
        clearWellipaySession();
        setToken(null);
        setStage('signin');
        return;
      }
      setStage('loading');
      setError(null);
      try {
        const t = await wellipayService.ensureToken(clerkToken);
        if (!active) return;
        setToken(t);
        await loadAll(t);
        if (active) setStage('ready');
      } catch (err) {
        if (!active) return;
        if (err instanceof WellipayError && err.code === 'not_linked') {
          setStage('link');
        } else {
          setError(err instanceof Error ? err.message : 'Could not load WelliPay.');
          setStage('ready');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [visible, isLoaded, isSignedIn, clerkToken, loadAll]);

  if (!visible) return null;

  const refresh = async () => {
    if (!token) return;
    try {
      await loadAll(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh.');
    }
  };

  const submitLink = async () => {
    const minor = nairaToMinor(linkAmount);
    if (!linkRef.trim() || minor === null) {
      setError('Enter the bill reference and the amount exactly as printed on your bill.');
      return;
    }
    setLinking(true);
    setError(null);
    try {
      const t = await wellipayService.link(clerkToken, linkRef, minor);
      setToken(t);
      await loadAll(t);
      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link your bill.');
    } finally {
      setLinking(false);
    }
  };

  const waitForResult = async (check: () => Promise<string>): Promise<string> => {
    for (let i = 0; i < 8; i += 1) {
      const status = await check();
      if (status !== 'PENDING') return status;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return 'PENDING';
  };

  const payCard = async (invoice: WellipayInvoice, email?: string) => {
    if (!token) return;
    setBusyId(invoice.invoiceId);
    setError(null);
    try {
      const charge = await wellipayService.startCardCharge(token, {
        invoiceId: invoice.invoiceId,
        email: email || undefined,
      });
      setEmailFor(null);
      await WebBrowser.openBrowserAsync(charge.authorizationUrl);
      const status = await waitForResult(async () => (await wellipayService.getTransaction(token, charge.reference)).status);
      actions.showToast(
        status === 'SUCCESS'
          ? 'Payment received'
          : status === 'FAILED'
            ? 'Payment failed. You were not charged.'
            : 'Payment is still processing. Check History shortly.',
      );
      await refresh();
    } catch (err) {
      if (err instanceof WellipayError && err.code === 'email_required') {
        setEmailFor(invoice);
      } else {
        setError(err instanceof Error ? err.message : 'Could not start the payment.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const payWallet = async (invoice: WellipayInvoice) => {
    if (!token) return;
    setBusyId(invoice.invoiceId);
    setError(null);
    try {
      await wellipayService.payFromWallet(token, { invoiceId: invoice.invoiceId });
      actions.showToast('Paid from your wallet');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pay from your wallet.');
    } finally {
      setBusyId(null);
    }
  };

  const topUp = async (email?: string) => {
    if (!token) return;
    const minor = nairaToMinor(topUpAmount);
    if (minor === null) {
      setError('Enter an amount in naira.');
      return;
    }
    setBusyId('topup');
    setError(null);
    try {
      const charge = await wellipayService.startTopUp(token, { amountMinor: minor, email });
      await WebBrowser.openBrowserAsync(charge.authorizationUrl);
      const status = await waitForResult(async () => (await wellipayService.getTopUp(token, charge.reference)).status);
      actions.showToast(
        status === 'SUCCESS' ? 'Wallet topped up' : status === 'FAILED' ? 'Top-up failed.' : 'Top-up is still processing.',
      );
      setTopUpAmount('');
      await refresh();
    } catch (err) {
      if (err instanceof WellipayError && err.code === 'email_required') {
        setError('Add an email for your receipt, then try again.');
        setEmailFor({ invoiceId: 'topup' } as WellipayInvoice);
      } else {
        setError(err instanceof Error ? err.message : 'Could not start the top-up.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const removeCard = async (methodId: string) => {
    if (!token) return;
    try {
      await wellipayService.removeCard(token, methodId);
      setCards((prev) => prev.filter((c) => c.methodId !== methodId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the card.');
    }
  };

  const outstandingOf = (inv: WellipayInvoice) => inv.amountMinor - inv.paidAmountMinor;
  const payable = (inv: WellipayInvoice) =>
    (inv.status === 'OPEN' || inv.status === 'PARTIALLY_PAID') && outstandingOf(inv) > 0;
  const totalDue = invoices.filter(payable).reduce((sum, inv) => sum + outstandingOf(inv), 0);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={actions.closeBilling}>
      <SafeAreaView style={styles.container}>
        <ModalHeader title="WelliPay" onClose={actions.closeBilling} />
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          {stage === 'loading' && <ActivityIndicator style={{ marginTop: 40 }} color={NAVY} />}

          {stage === 'unavailable' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>WelliPay is not available yet</Text>
              <Text style={styles.muted}>WelliPay is not available in this build. Contact support if this continues.</Text>
            </View>
          )}

          {stage === 'signin' && <WellipaySignIn />}

          {stage === 'link' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Link your bills</Text>
              <Text style={styles.muted}>
                Enter the reference and amount printed on a bill from your care provider. This links your WelliPay
                profile once.
              </Text>
              <TextInput value={linkRef} onChangeText={setLinkRef} placeholder="Bill reference" autoCapitalize="characters" style={styles.input} />
              <TextInput value={linkAmount} onChangeText={setLinkAmount} placeholder="Bill amount in naira" keyboardType="decimal-pad" style={styles.input} />
              <PrimaryButton label="Link my bills" busy={linking} onPress={submitLink} />
            </View>
          )}

          {stage === 'ready' && (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Amount due</Text>
                <Text style={styles.summaryValue}>{formatMinor(totalDue)}</Text>
                <Text style={styles.summarySub}>
                  Wallet {wallet ? formatMinor(wallet.balanceMinor, wallet.currency) : '—'}
                </Text>
              </View>

              <View style={styles.tabs}>
                {(['bills', 'wallet', 'history'] as Tab[]).map((t) => (
                  <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                    <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                      {t === 'bills' ? 'Bills' : t === 'wallet' ? 'Wallet' : 'History'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {emailFor && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Email for your receipt</Text>
                  <TextInput value={payEmail} onChangeText={setPayEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                  <PrimaryButton
                    label="Continue"
                    onPress={() => {
                      const email = payEmail.trim();
                      if (!email.includes('@')) {
                        setError('Enter a valid email address.');
                        return;
                      }
                      if (emailFor.invoiceId === 'topup') {
                        setEmailFor(null);
                        topUp(email);
                      } else {
                        payCard(emailFor, email);
                      }
                    }}
                  />
                </View>
              )}

              {tab === 'bills' &&
                (invoices.length === 0 ? (
                  <Text style={styles.empty}>No bills yet. Bills from your care providers appear here.</Text>
                ) : (
                  invoices.map((inv) => (
                    <View key={inv.invoiceId} style={styles.card}>
                      <View style={styles.row}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{inv.description || `Bill ${inv.providerInvoiceRef}`}</Text>
                        <Text style={styles.status}>{inv.status.replace('_', ' ')}</Text>
                      </View>
                      <Text style={styles.muted}>Ref {inv.providerInvoiceRef}</Text>
                      <Text style={styles.amount}>
                        {formatMinor(inv.amountMinor, inv.currency)}
                        {inv.paidAmountMinor > 0 ? `  ·  paid ${formatMinor(inv.paidAmountMinor, inv.currency)}` : ''}
                      </Text>
                      {payable(inv) && (
                        <View style={{ gap: 8, marginTop: 10 }}>
                          <PrimaryButton label={`Pay ${formatMinor(outstandingOf(inv))} by card`} busy={busyId === inv.invoiceId} onPress={() => payCard(inv)} />
                          {wallet && wallet.balanceMinor >= outstandingOf(inv) && (
                            <TouchableOpacity disabled={busyId === inv.invoiceId} onPress={() => payWallet(inv)} style={styles.secondary}>
                              <Text style={styles.secondaryText}>Pay from wallet</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))
                ))}

              {tab === 'wallet' && wallet && (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Wallet balance</Text>
                    <Text style={styles.amount}>{formatMinor(wallet.balanceMinor, wallet.currency)}</Text>
                    {wallet.providerName ? <Text style={styles.muted}>Credit with {wallet.providerName}</Text> : null}
                    <TextInput value={topUpAmount} onChangeText={setTopUpAmount} placeholder="Top-up amount in naira" keyboardType="decimal-pad" style={styles.input} />
                    <Text style={styles.muted}>
                      Between {formatMinor(wallet.minTopUpMinor)} and {formatMinor(wallet.maxTopUpMinor)}.
                    </Text>
                    <PrimaryButton label="Top up wallet" busy={busyId === 'topup'} onPress={() => topUp()} />
                  </View>

                  <Text style={styles.section}>Saved cards</Text>
                  {cards.length === 0 ? (
                    <Text style={styles.empty}>No saved cards.</Text>
                  ) : (
                    cards.map((c) => (
                      <View key={c.methodId} style={[styles.card, styles.row]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{c.brand} •••• {c.last4}</Text>
                          <Text style={styles.muted}>
                            {c.expMonth && c.expYear ? `Expires ${c.expMonth}/${c.expYear}` : ''}
                            {c.expired ? ' · expired' : ''}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeCard(c.methodId)}>
                          <Text style={styles.remove}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <Text style={styles.section}>Wallet activity</Text>
                  {wallet.entries.length === 0 ? (
                    <Text style={styles.empty}>No wallet activity yet.</Text>
                  ) : (
                    wallet.entries.map((e) => (
                      <View key={e.entryId} style={[styles.card, styles.row]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{e.kind.replace(/_/g, ' ').toLowerCase()}</Text>
                          <Text style={styles.muted}>{new Date(e.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.amount, { color: e.amountMinor < 0 ? '#9A3412' : '#166534' }]}>
                          {e.amountMinor < 0 ? '-' : '+'}{formatMinor(Math.abs(e.amountMinor))}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}

              {tab === 'history' &&
                (transactions.length === 0 ? (
                  <Text style={styles.empty}>No payments yet.</Text>
                ) : (
                  transactions.map((tx) => (
                    <View key={tx.transactionId} style={styles.card}>
                      <View style={styles.row}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{tx.description || tx.providerName || 'Payment'}</Text>
                        <Text style={styles.status}>{tx.status}</Text>
                      </View>
                      <Text style={styles.muted}>
                        {tx.providerName ? `${tx.providerName} · ` : ''}{new Date(tx.paidAt || tx.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.amount}>{formatMinor(tx.amountMinor, tx.currency)}</Text>
                      {tx.refundStatus && tx.refundStatus !== 'NONE' ? (
                        <Text style={styles.muted}>Refund {tx.refundStatus.toLowerCase()}{tx.refundedMinor ? ` · ${formatMinor(tx.refundedMinor)}` : ''}</Text>
                      ) : null}
                      {tx.failureReason ? <Text style={styles.error}>{tx.failureReason}</Text> : null}
                      <Text style={styles.ref}>Reference {tx.reference}</Text>
                    </View>
                  ))
                ))}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 14, gap: 6, backgroundColor: '#fff' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#173B68', flexShrink: 1 },
  muted: { fontSize: 12, lineHeight: 18, color: '#64748B' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { fontSize: 11, fontWeight: '700', color: '#315B90' },
  amount: { fontSize: 16, fontWeight: '800', color: NAVY },
  ref: { fontSize: 10.5, color: '#94A3B8' },
  input: { borderWidth: 1, borderColor: '#AFC3DD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#0F172A', marginTop: 6 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#315B90', fontSize: 13, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: '#315B90', fontSize: 13, fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 12.5, lineHeight: 18 },
  empty: { textAlign: 'center', color: '#64748B', fontSize: 13, paddingVertical: 24 },
  section: { fontSize: 16, fontWeight: '800', color: NAVY, marginTop: 8 },
  remove: { color: '#B91C1C', fontSize: 12.5, fontWeight: '600' },
  summary: { backgroundColor: NAVY, borderRadius: 18, padding: 18 },
  summaryLabel: { color: '#A8BCD5', fontSize: 12 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  summarySub: { color: '#A8BCD5', fontSize: 12, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 12.5, fontWeight: '600', color: '#173B68' },
  tabTextActive: { color: '#fff' },
});
