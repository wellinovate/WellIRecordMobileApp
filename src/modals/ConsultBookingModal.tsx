import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { Modal } from '../components/ActivityModal';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';
import type { AppointmentItem } from '../services/careService';
import {
  bookingService,
  type BookableProvider,
  type BookableSlot,
  type BookingConfig,
  type PayMethod,
  type VisitMode,
} from '../services/bookingService';
import {
  formatMinor,
  isWellipayConfigured,
  newIdempotencyKey,
  wellipayService,
  type WellipayHmoPolicy,
} from '../services/wellipayService';

type Step = 'type' | 'date' | 'provider' | 'payment' | 'review' | 'done';

const STEP_NUMBER: Record<Exclude<Step, 'done'>, number> = { type: 1, date: 2, provider: 3, payment: 4, review: 5 };
const STEP_TITLE: Record<Exclude<Step, 'done'>, string> = {
  type: 'Choose consultation type',
  date: 'Select a date',
  provider: 'Choose a provider and time',
  payment: 'Choose payment method',
  review: 'Review and confirm',
};

const BLUE = '#315B90';

const dayLabel = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
const longDay = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

const lagosYmd = (iso: string) => new Date(Date.parse(iso) + 60 * 60 * 1000).toISOString().slice(0, 10);

const hmoMatches = (accepted: string[], name: string) => {
  const n = name.trim().toLowerCase();
  return n.length > 0 && accepted.some((a) => a.trim().toLowerCase() === n);
};

const policyUsable = (p: WellipayHmoPolicy, accepted: string[]) => {
  if (String(p.status).toUpperCase() !== 'ACTIVE') return false;
  if (p.expiryDate && new Date(p.expiryDate).getTime() < Date.now()) return false;
  return hmoMatches(accepted, p.provider);
};

function Chip({ on, label, onPress, disabled }: { on?: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      className={`min-h-[44px] justify-center rounded-xl border px-4 ${on ? 'border-[#315B90] bg-[#EEF3FA]' : 'border-slate-200 bg-white'}`}
    >
      <Text className={`text-[12.5px] font-semibold ${on ? 'text-[#173B68]' : 'text-slate-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ConsultBookingModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const { getToken } = useAuth();
  const facilityId = state.consultFacilityId || undefined;

  const [step, setStep] = useState<Step>('type');
  const [mode, setMode] = useState<VisitMode | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [providers, setProviders] = useState<BookableProvider[]>([]);
  const [chosen, setChosen] = useState<{ provider: BookableProvider; slot: BookableSlot } | null>(null);
  const [hold, setHold] = useState<{ holdId: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [policies, setPolicies] = useState<WellipayHmoPolicy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [hmoNote, setHmoNote] = useState('');
  const [memberId, setMemberId] = useState('me');
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ appointment: AppointmentItem; notice: string; payUrl?: string } | null>(null);
  const holdRef = useRef<string | null>(null);
  holdRef.current = hold?.holdId ?? null;

  const visible = state.showConsultBooking;

  const reset = useCallback(() => {
    setStep('type');
    setMode(null);
    setDates([]);
    setDate('');
    setProviders([]);
    setChosen(null);
    setHold(null);
    setMethod(null);
    setPolicies([]);
    setPolicyId('');
    setHmoNote('');
    setMemberId('me');
    setReason('');
    setAccepted(false);
    setBusy(false);
    setError('');
    setResult(null);
  }, []);

  // Start fresh each time the flow opens, and load the booking terms and payment options.
  useEffect(() => {
    if (!visible) return;
    reset();
    bookingService.config().then(setConfig).catch(() => setConfig(null));
  }, [visible, reset]);

  const releaseHold = useCallback(() => {
    const id = holdRef.current;
    if (id) {
      holdRef.current = null;
      void bookingService.release(id);
    }
    setHold(null);
  }, []);

  // Count down the held time while the person is paying and reviewing.
  useEffect(() => {
    if (!hold || (step !== 'payment' && step !== 'review')) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((hold.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setHold(null);
        setChosen(null);
        setStep('provider');
        setError('Your held time ran out. Choose a time again.');
        if (mode && date) loadProviders(mode, date);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold, step]);

  const loadDates = async (m: VisitMode) => {
    setBusy(true);
    setError('');
    try {
      const d = await bookingService.dates(m, facilityId);
      setDates(d);
      if (!d.length) setError(`No clinic is taking ${m === 'video' ? 'virtual' : 'in-person'} bookings right now, or every time is taken. Go back and try the other visit type, or check again later.`);
    } catch (err: any) {
      setError(err?.message || 'Could not load dates. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const loadProviders = async (m: VisitMode, d: string) => {
    setBusy(true);
    setError('');
    try {
      setProviders(await bookingService.availability(m, d, facilityId));
    } catch (err: any) {
      setError(err?.message || 'Could not load providers. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    releaseHold();
    actions.closeConsultBooking();
  };

  const pickMode = (m: VisitMode) => {
    hapticFeedback.selection();
    setMode(m);
    setDate('');
    setStep('date');
    void loadDates(m);
  };

  const pickDate = (d: string) => {
    hapticFeedback.selection();
    setDate(d);
    setStep('provider');
    if (mode) void loadProviders(mode, d);
  };

  const pickSlot = async (provider: BookableProvider, slot: BookableSlot) => {
    if (busy || !mode) return;
    hapticFeedback.selection();
    setBusy(true);
    setError('');
    try {
      const h = await bookingService.hold(provider.facilityId, mode, slot.startsAt);
      setHold({ holdId: h.holdId, expiresAt: new Date(h.expiresAt).getTime() });
      setChosen({ provider, slot });
      setMethod(null);
      setAccepted(false);
      setStep('payment');
    } catch (err: any) {
      setError(err?.message || 'That time is no longer available. Choose another.');
      void loadProviders(mode, date);
    } finally {
      setBusy(false);
    }
  };

  // Your HMO plans come from WelliPay. They are only read when the provider accepts an HMO.
  const loadPolicies = useCallback(async () => {
    setHmoNote('');
    if (!isWellipayConfigured) {
      setHmoNote('HMO cover is not available in this version yet.');
      return;
    }
    try {
      const t = await wellipayService.ensureToken(() => getToken());
      setPolicies(await wellipayService.listHmoPolicies(t));
    } catch (err: any) {
      setHmoNote(
        err?.code === 'not_linked'
          ? 'Link your HMO plan under Coverage first, then come back.'
          : 'Could not check your HMO plans right now.'
      );
    }
  }, [getToken]);

  useEffect(() => {
    if (step === 'payment' && chosen && chosen.provider.acceptsHmo.length > 0 && policies.length === 0 && !hmoNote) {
      void loadPolicies();
    }
  }, [step, chosen, policies.length, hmoNote, loadPolicies]);

  const usablePolicies = useMemo(
    () => (chosen ? policies.filter((p) => policyUsable(p, chosen.provider.acceptsHmo)) : []),
    [policies, chosen]
  );

  const patientName = useMemo(() => {
    const m = family.find((f) => f.id === memberId) || family[0];
    return m?.name || 'You';
  }, [family, memberId]);

  const confirm = async () => {
    if (!chosen || !hold || !method || !accepted || busy) return;
    setBusy(true);
    setError('');
    try {
      let hmo;
      if (method === 'hmo') {
        const pol = usablePolicies.find((p) => p.hmoPolicyId === policyId);
        if (!pol) throw new Error('Choose the HMO plan to use.');
        // Ask the HMO first. A declined cover stops here so the person can pay another way.
        let pre;
        try {
          const t = await wellipayService.ensureToken(() => getToken());
          pre = await wellipayService.createPreAuth(
            t,
            {
              hmoPolicyId: pol.hmoPolicyId,
              facilityRef: chosen.provider.facilityId,
              procedure: mode === 'video' ? 'Virtual consultation' : 'Consultation',
              estimatedCostMinor: chosen.provider.feeMinor,
            },
            newIdempotencyKey()
          );
        } catch {
          throw new Error('Could not check your cover right now. Try again, or choose another payment method.');
        }
        if (String(pre.status).toUpperCase() === 'DECLINED') {
          throw new Error('Your HMO did not approve cover for this consultation. Choose another payment method.');
        }
        hmo = {
          provider: pol.provider,
          policyId: pol.hmoPolicyId,
          policyLabel: `${pol.provider} · ${pol.policyNo}`,
          preAuthId: pre.preAuthId,
          preAuthStatus: pre.status,
        };
      }
      const r = await bookingService.confirm({
        holdId: hold.holdId,
        paymentMethod: method,
        familyMemberId: memberId !== 'me' ? memberId : undefined,
        reason: reason.trim() || undefined,
        hmo,
      });
      holdRef.current = null;
      setHold(null);
      actions.upsertAppointment(r.appointment);
      hapticFeedback.success();
      setResult({ appointment: r.appointment, notice: r.notice, payUrl: r.authorizationUrl });
      setStep('done');
      if (r.authorizationUrl) void payOnline(r.appointment.id, r.authorizationUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not complete the booking. Try again.');
      if (err?.statusCode === 410) {
        setHold(null);
        setChosen(null);
        setStep('provider');
        if (mode && date) void loadProviders(mode, date);
      }
    } finally {
      setBusy(false);
    }
  };

  // Opens the payment page, then asks the server whether the payment went through.
  const payOnline = async (id: string, url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      /* the person can reopen it from this screen */
    }
    await checkPayment(id);
  };

  const checkPayment = async (id: string) => {
    setBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const a = await bookingService.status(id);
        actions.upsertAppointment(a);
        setResult((r) => (r ? { ...r, appointment: a } : r));
        if (a.status !== 'awaiting_payment') break;
        await new Promise((res) => setTimeout(res, 2000));
      }
    } catch {
      /* leave the last known status on screen */
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  const fee = chosen ? formatMinor(chosen.provider.feeMinor, chosen.provider.currency) : '';
  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const methodLabel = method === 'online' ? 'Pay online' : method === 'in_person' ? 'Pay in person' : method === 'hmo' ? 'HMO cover' : '';

  const back = () => {
    setError('');
    if (step === 'date') setStep('type');
    else if (step === 'provider') setStep('date');
    else if (step === 'payment') {
      releaseHold();
      setChosen(null);
      setStep('provider');
      if (mode && date) void loadProviders(mode, date);
    } else if (step === 'review') setStep('payment');
  };

  const renderHeader = () => (
    <View className="min-h-[44px] flex-row items-center justify-between">
      {step === 'type' || step === 'done' ? (
        <View className="h-11 w-11" />
      ) : (
        <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-slate-50">
          <Text className="text-[22px] text-[#315B90]">‹</Text>
        </TouchableOpacity>
      )}
      <Text className="text-[12px] font-semibold text-slate-800">Telemedicine</Text>
      <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close" className="h-11 w-11 items-center justify-center rounded-full bg-slate-50">
        <Text className="text-[16px] text-slate-500">✕</Text>
      </TouchableOpacity>
    </View>
  );

  const summaryRows: [string, string][] = chosen
    ? [
        ['Provider', chosen.provider.name],
        ['Consultation', mode === 'video' ? 'Virtual' : 'In person'],
        ['Date', longDay(date)],
        ['Time', chosen.slot.label],
        [mode === 'video' ? 'How you join' : 'Location', mode === 'video' ? 'Secure join button under Upcoming visits, opens 10 minutes before the start' : chosen.provider.address || 'Shown after booking'],
        ['Fee', fee],
        ['For', patientName],
      ]
    : [];

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderHeader()}

          {step !== 'done' && (
            <View className="mt-3">
              <Text className="text-[11px] font-semibold text-[#315B90]">Step {STEP_NUMBER[step as Exclude<Step, 'done'>]} of 5</Text>
              <Text className="mt-1 text-[24px] leading-[30px] font-extrabold text-[#082F67]">{STEP_TITLE[step as Exclude<Step, 'done'>]}</Text>
            </View>
          )}

          {!!error && (
            <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3" accessibilityRole="alert">
              <Text className="text-[12.5px] leading-[18px] text-red-800">{error}</Text>
            </View>
          )}

          {step === 'type' && (
            <View className="mt-5">
              <Text className="text-[13px] leading-[19px] text-slate-500">Select how you want to see the provider.</Text>
              {(
                [
                  ['in_person', 'In person', 'Go to the provider for your consultation.'],
                  ['video', 'Virtual', 'See the provider by secure video from your phone.'],
                ] as const
              ).map(([m, title, text]) => (
                <TouchableOpacity key={m} onPress={() => pickMode(m)} accessibilityRole="button" className="mt-3 min-h-[72px] justify-center rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4">
                  <Text className="text-[16px] font-bold text-[#173B68]">{title}</Text>
                  <Text className="mt-1 text-[12px] leading-[18px] text-slate-500">{text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 'date' && (
            <View className="mt-5">
              {busy ? <ActivityIndicator color={BLUE} /> : null}
              <Text className="text-[13px] leading-[19px] text-slate-500">Only dates with an open time are shown.</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {dates.map((d) => (
                  <Chip key={d} label={dayLabel(d)} on={date === d} onPress={() => pickDate(d)} />
                ))}
              </View>
            </View>
          )}

          {step === 'provider' && (
            <View className="mt-5">
              {busy && providers.length === 0 ? <ActivityIndicator color={BLUE} /> : null}
              <Text className="text-[13px] leading-[19px] text-slate-500">
                {longDay(date)} · {mode === 'video' ? 'Virtual' : 'In person'}. Fees are for this visit type.
              </Text>
              {!busy && providers.length === 0 ? (
                <Text className="mt-4 text-[13px] text-slate-500">No provider has an open time on this date. Choose another date.</Text>
              ) : null}
              {providers.map((p) => (
                <View key={p.facilityId} className="mt-4 rounded-2xl border border-slate-200 p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-[15px] font-bold text-[#173B68]">{p.name}</Text>
                      <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                        {p.specialty || 'Consultation'}
                        {p.address ? ` · ${p.address}` : ''}
                      </Text>
                    </View>
                    <Text className="text-[15px] font-extrabold text-[#082F67]">{formatMinor(p.feeMinor, p.currency)}</Text>
                  </View>
                  <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                    {p.acceptsHmo.length ? `HMO accepted: ${p.acceptsHmo.join(', ')}` : 'No HMO cover accepted'}
                  </Text>
                  <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">
                    Pay: {[p.onlinePayment && config?.onlinePayment ? 'online' : '', p.payAtVisit ? 'in person' : '', p.acceptsHmo.length ? 'HMO' : ''].filter(Boolean).join(', ') || 'not available'}
                  </Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {p.slots.map((s) => (
                      <Chip key={s.startsAt} label={s.label} onPress={() => void pickSlot(p, s)} disabled={busy} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {(step === 'payment' || step === 'review') && chosen && (
            <View className="mt-3 rounded-xl bg-[#FFF7E6] px-3 py-2" accessibilityLiveRegion="polite">
              <Text className="text-[12px] font-semibold text-[#92400E]">
                {chosen.slot.label}, {dayLabel(date)} held for {mins}:{secs}
              </Text>
            </View>
          )}

          {step === 'payment' && chosen && (
            <View className="mt-5">
              <Text className="text-[13px] leading-[19px] text-slate-500">Fee for this {mode === 'video' ? 'virtual' : 'in-person'} visit: {fee}</Text>

              {(() => {
                const onlineOk = chosen.provider.onlinePayment && !!config?.onlinePayment;
                const opt = (m: PayMethod, title: string, text: string, enabled: boolean) => (
                  <TouchableOpacity
                    key={m}
                    disabled={!enabled}
                    onPress={() => {
                      hapticFeedback.selection();
                      setMethod(m);
                      setError('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === m, disabled: !enabled }}
                    className={`mt-3 rounded-2xl border p-4 ${method === m ? 'border-[#315B90] bg-[#EEF3FA]' : 'border-slate-200 bg-white'} ${enabled ? '' : 'opacity-50'}`}
                  >
                    <Text className="text-[14px] font-bold text-[#173B68]">{title}</Text>
                    <Text className="mt-1 text-[11.5px] leading-[17px] text-slate-500">{text}</Text>
                  </TouchableOpacity>
                );
                return (
                  <>
                    {opt('online', 'Pay online', onlineOk ? 'Pay now. Your booking is confirmed when the payment succeeds.' : 'Not available for this provider yet.', onlineOk)}
                    {chosen.provider.payAtVisit
                      ? opt('in_person', 'Pay in person', 'Your booking is confirmed now. You pay at the visit.', true)
                      : null}
                    {chosen.provider.acceptsHmo.length
                      ? opt(
                          'hmo',
                          'Use HMO cover',
                          usablePolicies.length
                            ? 'Subject to eligibility and approval. Your booking shows as awaiting HMO confirmation until the provider confirms.'
                            : hmoNote || 'Checking your HMO plans…',
                          usablePolicies.length > 0
                        )
                      : null}
                  </>
                );
              })()}

              {method === 'hmo' && usablePolicies.length > 0 && (
                <View className="mt-4">
                  <Text className="text-[12px] font-semibold text-[#173B68]">HMO plan</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {usablePolicies.map((p) => (
                      <Chip key={p.hmoPolicyId} label={`${p.provider} · ${p.policyNo}`} on={policyId === p.hmoPolicyId} onPress={() => setPolicyId(p.hmoPolicyId)} />
                    ))}
                  </View>
                  <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">
                    Co-payment may apply. The provider confirms what your plan covers.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                disabled={!method || (method === 'hmo' && !policyId)}
                onPress={() => setStep('review')}
                accessibilityRole="button"
                className={`mt-6 min-h-[48px] items-center justify-center rounded-xl ${!method || (method === 'hmo' && !policyId) ? 'bg-slate-200' : 'bg-[#082F67]'}`}
              >
                <Text className={`text-[14px] font-semibold ${!method || (method === 'hmo' && !policyId) ? 'text-slate-400' : 'text-white'}`}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'review' && chosen && (
            <View className="mt-5">
              {family.length > 1 && (
                <View className="mb-4">
                  <Text className="text-[12px] font-semibold text-[#173B68]">Visit for</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {family.map((m) => (
                      <Chip key={m.id} label={m.id === 'me' ? 'Myself' : m.name.split(' ')[0]} on={memberId === m.id} onPress={() => setMemberId(m.id)} />
                    ))}
                  </View>
                </View>
              )}

              <View className="rounded-2xl border border-slate-200 p-4">
                {[...summaryRows, ['Payment', methodLabel] as [string, string]].map(([k, v]) => (
                  <View key={k} className="flex-row justify-between py-1.5">
                    <Text className="w-[34%] text-[12px] text-slate-500">{k}</Text>
                    <Text className="w-[64%] text-right text-[12.5px] font-semibold text-slate-800">{v}</Text>
                  </View>
                ))}
              </View>

              <Text className="mt-4 text-[12px] font-semibold text-[#173B68]">Note for the care team (optional)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="What would you like to discuss?"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={500}
                textAlignVertical="top"
                className="mt-2 min-h-[80px] rounded-2xl border border-slate-200 p-4 text-[14px] leading-[20px] text-slate-900"
              />

              <View className="mt-4 rounded-2xl bg-[#F3F6FB] p-4">
                <Text className="text-[12.5px] font-bold text-[#173B68]">Booking terms</Text>
                {(config?.terms || []).map((t) => (
                  <Text key={t} className="mt-1.5 text-[11.5px] leading-[17px] text-[#536A84]">
                    • {t}
                  </Text>
                ))}
              </View>
              <TouchableOpacity onPress={() => setAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} className="mt-3 min-h-[44px] flex-row items-center">
                <View className={`h-6 w-6 items-center justify-center rounded-md border ${accepted ? 'border-[#082F67] bg-[#082F67]' : 'border-slate-300'}`}>
                  {accepted ? <Text className="text-[14px] text-white">✓</Text> : null}
                </View>
                <Text className="ml-3 flex-1 text-[12.5px] text-slate-700">I have read and accept the booking terms</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!accepted || busy}
                onPress={() => void confirm()}
                accessibilityRole="button"
                className={`mt-4 min-h-[48px] items-center justify-center rounded-xl ${!accepted || busy ? 'bg-slate-200' : 'bg-[#082F67]'}`}
              >
                <Text className={`text-[14px] font-semibold ${!accepted || busy ? 'text-slate-400' : 'text-white'}`}>
                  {busy ? 'Working…' : method === 'online' ? `Pay ${fee} and book` : method === 'hmo' ? 'Request HMO booking' : 'Confirm booking'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'done' && result && (
            <View className="mt-6">
              {(() => {
                const a = result.appointment;
                const title =
                  a.status === 'confirmed'
                    ? 'Booking confirmed'
                    : a.status === 'awaiting_hmo'
                      ? 'Awaiting HMO confirmation'
                      : a.status === 'awaiting_payment'
                        ? 'Waiting for your payment'
                        : a.status === 'cancelled'
                          ? 'Booking not completed'
                          : 'Booking saved';
                const tint = a.status === 'confirmed' ? 'text-green-700' : a.status === 'cancelled' ? 'text-red-700' : 'text-amber-700';
                return (
                  <>
                    <Text className={`text-[24px] leading-[30px] font-extrabold ${tint}`}>{title}</Text>
                    {a.bookingRef ? <Text className="mt-2 text-[13px] text-slate-600">Booking reference <Text className="font-bold text-slate-900">{a.bookingRef}</Text></Text> : null}
                    <Text className="mt-2 text-[13px] leading-[19px] text-slate-600">
                      {a.status === 'cancelled' ? 'The payment was not completed and your time was released. Book again to choose a time.' : result.notice}
                    </Text>

                    <View className="mt-4 rounded-2xl border border-slate-200 p-4">
                      {[
                        ['Provider', a.facilityName],
                        ['Consultation', a.visitType === 'video' ? 'Virtual' : 'In person'],
                        ['Date', a.startsAt ? longDay(lagosYmd(a.startsAt)) : '—'],
                        ['Time', a.timeSlot],
                        a.visitType === 'video' ? ['How you join', 'Open Upcoming visits 10 minutes before the start'] : ['Location', a.facilityAddress || '—'],
                        ['Fee', a.feeMinor != null ? formatMinor(a.feeMinor, a.currency || 'NGN') : '—'],
                        ['Payment', a.paymentStatus === 'paid' ? 'Paid online' : a.paymentStatus === 'pay_at_visit' ? 'Pay at the visit' : a.paymentStatus === 'awaiting_hmo' ? 'Awaiting HMO confirmation' : a.paymentStatus === 'pending' ? 'Waiting for payment' : a.paymentStatus || '—'],
                      ].map(([k, v]) => (
                        <View key={k} className="flex-row justify-between py-1.5">
                          <Text className="w-[34%] text-[12px] text-slate-500">{k}</Text>
                          <Text className="w-[64%] text-right text-[12.5px] font-semibold text-slate-800">{v}</Text>
                        </View>
                      ))}
                    </View>

                    {a.status === 'awaiting_payment' && (
                      <>
                        <TouchableOpacity disabled={busy} onPress={() => void checkPayment(a.id)} accessibilityRole="button" className="mt-4 min-h-[48px] items-center justify-center rounded-xl bg-[#082F67]">
                          <Text className="text-[14px] font-semibold text-white">{busy ? 'Checking…' : 'I have paid, check now'}</Text>
                        </TouchableOpacity>
                        {result.payUrl ? (
                          <TouchableOpacity onPress={() => void payOnline(a.id, result.payUrl!)} accessibilityRole="button" className="mt-2 min-h-[44px] items-center justify-center">
                            <Text className="text-[13px] font-semibold text-[#315B90]">Open the payment page again</Text>
                          </TouchableOpacity>
                        ) : null}
                      </>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        close();
                        actions.openUpcomingVisits();
                      }}
                      accessibilityRole="button"
                      className="mt-4 min-h-[48px] items-center justify-center rounded-xl border border-slate-200"
                    >
                      <Text className="text-[14px] font-semibold text-[#173B68]">View upcoming visits</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
