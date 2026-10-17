import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import {
  WellipayError,
  clearWellipaySession,
  formatMinor,
  isWellipayConfigured,
  newIdempotencyKey,
  wellipayService,
  type WellipayFundingRequest,
  type WellipayHmoPolicy,
  type WellipayPreAuth,
} from '../services/wellipayService';
import type { WelliApp } from '../state/useWelliApp';

type Stage = 'loading' | 'unavailable' | 'signin' | 'link' | 'ready';
type Form = null | 'policy' | 'preauth';

const naira = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);

export function CoverageModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const visible = Boolean(state.showCoverage);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [stage, setStage] = useState<Stage>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [policies, setPolicies] = useState<WellipayHmoPolicy[]>([]);
  const [preAuths, setPreAuths] = useState<WellipayPreAuth[]>([]);
  const [funding, setFunding] = useState<WellipayFundingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string>(newIdempotencyKey());

  const [provider, setProvider] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [enrollee, setEnrollee] = useState('');
  const [plan, setPlan] = useState('');
  const [coPay, setCoPay] = useState('');
  const [limit, setLimit] = useState('');

  const [policyId, setPolicyId] = useState<string | null>(null);
  const [facility, setFacility] = useState('');
  const [procedure, setProcedure] = useState('');
  const [estimate, setEstimate] = useState('');

  const clerkToken = useCallback(() => getToken(), [getToken]);

  const loadAll = useCallback(async (t: string) => {
    const [p, a, f] = await Promise.all([
      wellipayService.listHmoPolicies(t),
      wellipayService.listPreAuths(t),
      wellipayService.listFamilyFunding(t),
    ]);
    setPolicies(p);
    setPreAuths(a);
    setFunding(f);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      if (!isWellipayConfigured) return setStage('unavailable');
      if (!isLoaded) return;
      if (!isSignedIn) {
        clearWellipaySession();
        return setStage('signin');
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
        if (err instanceof WellipayError && err.code === 'not_linked') setStage('link');
        else {
          setError(err instanceof Error ? err.message : 'Could not load coverage.');
          setStage('ready');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, isLoaded, isSignedIn, clerkToken, loadAll]);

  if (!visible) return null;

  const close = () => {
    setForm(null);
    actions.closeCoverage();
  };

  const submitPolicy = async () => {
    const pct = Number(coPay);
    if (!token || !provider.trim() || !policyNo.trim() || !enrollee.trim() || !plan.trim() || !(pct >= 0 && pct <= 100)) {
      setError('Fill in every field. Co-pay is a percentage from 0 to 100.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await wellipayService.addHmoPolicy(
        token,
        {
          provider: provider.trim(),
          policyNo: policyNo.trim(),
          enrolleeName: enrollee.trim(),
          planTier: plan.trim(),
          coPayPercent: Math.round(pct),
          annualLimitMinor: Math.max(0, naira(limit || '0')),
        },
        keyRef.current,
      );
      keyRef.current = newIdempotencyKey();
      setForm(null);
      setProvider('');
      setPolicyNo('');
      setEnrollee('');
      setPlan('');
      setCoPay('');
      setLimit('');
      await loadAll(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the policy.');
    } finally {
      setBusy(false);
    }
  };

  const submitPreAuth = async () => {
    const cost = naira(estimate);
    if (!token || !policyId || !facility.trim() || !procedure.trim() || !(cost > 0)) {
      setError('Choose a policy and fill in the facility, procedure and estimated cost.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await wellipayService.createPreAuth(
        token,
        { hmoPolicyId: policyId, facilityRef: facility.trim(), procedure: procedure.trim(), estimatedCostMinor: cost },
        keyRef.current,
      );
      keyRef.current = newIdempotencyKey();
      setForm(null);
      setFacility('');
      setProcedure('');
      setEstimate('');
      await loadAll(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }];
  const field = (value: string, set: (v: string) => void, placeholder: string, keyboard?: 'numeric') => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor={theme.mutedLight}
      keyboardType={keyboard}
      style={input}
    />
  );
  const primary = (label: string, onPress: () => void) => (
    <TouchableOpacity disabled={busy} onPress={onPress} accessibilityRole="button" style={[styles.btn, { opacity: busy ? 0.6 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{label}</Text>}
    </TouchableOpacity>
  );

  const body = () => {
    if (stage === 'loading') return <ActivityIndicator style={{ marginTop: 40 }} />;
    if (stage === 'unavailable')
      return <Text style={[styles.sub, { color: theme.muted }]}>WelliPay is not available in this build. Contact support if this continues.</Text>;
    if (stage === 'signin' || stage === 'link')
      return (
        <View style={{ gap: 12 }}>
          <Text style={[styles.sub, { color: theme.muted }]}>
            {stage === 'signin'
              ? 'Sign in to WelliPay to see your coverage.'
              : 'Link a bill in WelliPay first. Coverage uses the same account.'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.btn}
            onPress={() => {
              close();
              actions.openBilling();
            }}
          >
            <Text style={styles.btnText}>Open WelliPay</Text>
          </TouchableOpacity>
        </View>
      );

    if (form === 'policy')
      return (
        <View style={{ gap: 8 }}>
          <Text style={[styles.heading, { color: theme.text }]}>Add an HMO policy</Text>
          {field(provider, setProvider, 'HMO provider')}
          {field(policyNo, setPolicyNo, 'Policy or enrollee number')}
          {field(enrollee, setEnrollee, 'Name on the card')}
          {field(plan, setPlan, 'Plan name')}
          {field(coPay, setCoPay, 'Your co-pay, % (0 to 100)', 'numeric')}
          {field(limit, setLimit, 'Annual limit in naira (optional)', 'numeric')}
          {primary('Save policy', submitPolicy)}
          <TouchableOpacity onPress={() => setForm(null)} style={styles.link}>
            <Text style={[styles.sub, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );

    if (form === 'preauth')
      return (
        <View style={{ gap: 8 }}>
          <Text style={[styles.heading, { color: theme.text }]}>Request pre-authorisation</Text>
          <Text style={[styles.label, { color: theme.muted }]}>POLICY</Text>
          {policies.map((p) => (
            <TouchableOpacity
              key={p.hmoPolicyId}
              onPress={() => setPolicyId(p.hmoPolicyId)}
              accessibilityRole="button"
              style={[styles.card, { borderColor: policyId === p.hmoPolicyId ? '#082F67' : theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.name, { color: theme.text }]}>{p.provider}</Text>
              <Text style={[styles.sub, { color: theme.muted }]}>{p.policyNo} · {p.planTier}</Text>
            </TouchableOpacity>
          ))}
          {field(facility, setFacility, 'Facility name')}
          {field(procedure, setProcedure, 'Procedure or treatment')}
          {field(estimate, setEstimate, 'Estimated cost in naira', 'numeric')}
          {primary('Send request', submitPreAuth)}
          <TouchableOpacity onPress={() => setForm(null)} style={styles.link}>
            <Text style={[styles.sub, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );

    return (
      <View style={{ gap: 10 }}>
        <Text style={[styles.heading, { color: theme.text }]}>HMO policies</Text>
        {policies.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>No policies added yet.</Text>}
        {policies.map((p) => (
          <View key={p.hmoPolicyId} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.name, { color: theme.text }]}>{p.provider} · {p.planTier}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>Policy {p.policyNo} · {p.enrolleeName}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>
              Co-pay {p.coPayPercent}% · Status {p.status.toLowerCase()}
            </Text>
            {p.annualLimit.amountMinor > 0 && (
              <Text style={[styles.sub, { color: theme.muted }]}>
                Used {formatMinor(p.usedAmount.amountMinor, p.usedAmount.currency)} of {formatMinor(p.annualLimit.amountMinor, p.annualLimit.currency)}
              </Text>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={() => { setError(null); setForm('policy'); }} accessibilityRole="button" style={styles.btnAlt}>
          <Text style={styles.btnAltText}>Add a policy</Text>
        </TouchableOpacity>

        <Text style={[styles.heading, { color: theme.text, marginTop: 14 }]}>Pre-authorisations</Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          WelliPay records the request and splits the cost using your policy's co-pay. It does not contact your HMO yet. Confirm approval with your HMO before treatment.
        </Text>
        {preAuths.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>No requests yet.</Text>}
        {preAuths.map((a) => (
          <View key={a.preAuthId} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.name, { color: theme.text }]}>{a.procedure}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>{a.facilityRef} · {new Date(a.requestedAt).toLocaleDateString('en-GB')}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>
              Estimate {formatMinor(a.estimatedCost.amountMinor, a.estimatedCost.currency)} · Your share {formatMinor(a.patientPortion.amountMinor, a.patientPortion.currency)}
            </Text>
            <Text style={[styles.sub, { color: theme.text }]}>Status {a.status.replace('_', ' ').toLowerCase()}</Text>
          </View>
        ))}
        {policies.length > 0 && (
          <TouchableOpacity
            onPress={() => { setError(null); setPolicyId(policies[0].hmoPolicyId); setForm('preauth'); }}
            accessibilityRole="button"
            style={styles.btnAlt}
          >
            <Text style={styles.btnAltText}>Request pre-authorisation</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.heading, { color: theme.text, marginTop: 14 }]}>Family funding</Text>
        {funding.length === 0 && (
          <Text style={[styles.sub, { color: theme.muted }]}>No family funding requests. When a facility asks relatives to contribute to a bill, it shows here.</Text>
        )}
        {funding.map((f) => (
          <View key={f.requestId} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.name, { color: theme.text }]}>Funded {formatMinor(f.fundedAmountMinor, f.currency)}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>Status {f.status.toLowerCase()} · {new Date(f.createdAt).toLocaleDateString('en-GB')}</Text>
            {f.contributions.map((c) => (
              <Text key={c.contributionId} style={[styles.sub, { color: theme.muted }]}>
                {formatMinor(c.amountMinor, f.currency)} from {c.sponsorRef} · {c.status.toLowerCase()}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader title="HMO and coverage" onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!error && <Text style={styles.error}>{error}</Text>}
          {body()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  name: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 48 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center' },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', fontSize: 13, marginBottom: 10 },
});
