import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Modal } from '../components/ActivityModal';
import { WelliBadge } from '../components/WelliBadge';
import { hapticFeedback } from '../utils/haptics';
import { pickImageFromCamera, pickImageFromLibrary } from '../utils/mediaPicker';
import { formatDistance, getDevicePosition, type Position } from '../utils/nearby';
import { formatMinor } from '../services/wellipayService';
import type { WelliApp } from '../state/useWelliApp';
import {
  ORDER_OPEN,
  STATUS_LABEL,
  pharmacyOrderService,
  type CheckoutPreview,
  type Fulfilment,
  type OrderConfig,
  type OrderPayMethod,
  type OrderPharmacy,
  type PharmacyOrder,
} from '../services/pharmacyOrderService';

type View_ = 'list' | 'pick' | 'request' | 'detail' | 'checkout';
interface DraftItem { name: string; strength: string; quantity: string; notes: string }
interface DraftFile { id: string; contentType: string; label: string }

const BLUE = '#315B90';
const MAX_ITEMS = 20;
const emptyItem = (): DraftItem => ({ name: '', strength: '', quantity: '1', notes: '' });
const PAY_LABEL: Record<OrderPayMethod, string> = {
  online: 'Pay online',
  on_delivery: 'Pay on delivery',
  at_pickup: 'Pay at pickup',
  hmo: 'Use my HMO',
};
const TERMINAL = ['delivered', 'collected', 'cancelled', 'rejected', 'expired'];

function Box({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'error' | 'note' }) {
  const cls = tone === 'error' ? 'border-red-200 bg-red-50' : tone === 'note' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-[#F8FAFD]';
  return <View className={`mt-3 rounded-2xl border p-4 ${cls}`}>{children}</View>;
}

function Chip({ on, label, onPress, disabled }: { on?: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      className={`min-h-[44px] justify-center rounded-xl border px-4 ${on ? 'border-[#315B90] bg-[#EEF3FA]' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-[12.5px] font-semibold ${on ? 'text-[#173B68]' : 'text-slate-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="mt-3 min-h-[44px] flex-row items-start">
      <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${on ? 'border-[#315B90] bg-[#315B90]' : 'border-slate-300 bg-white'}`}>
        {on ? <Text className="text-[12px] font-bold text-white">✓</Text> : null}
      </View>
      <Text className="ml-3 flex-1 text-[12.5px] leading-[18px] text-slate-700">{label}</Text>
    </TouchableOpacity>
  );
}

function Primary({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const off = busy || disabled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      className={`mt-5 min-h-[48px] items-center justify-center rounded-2xl bg-[#315B90] px-4 ${off ? 'opacity-50' : ''}`}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-bold text-white">{label}</Text>}
    </TouchableOpacity>
  );
}

const input = 'mt-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800';

export function PharmacyOrdersModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const visible = state.showPharmacyOrders;

  const [view, setView] = useState<View_>('list');
  const [config, setConfig] = useState<OrderConfig | null>(null);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [pharmacies, setPharmacies] = useState<OrderPharmacy[]>([]);
  const [pos, setPos] = useState<Position | null>(null);
  const [pharmacy, setPharmacy] = useState<OrderPharmacy | null>(null);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [shareOk, setShareOk] = useState(false);
  const [linkOk, setLinkOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [order, setOrder] = useState<PharmacyOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // checkout
  const [fulfilment, setFulfilment] = useState<Fulfilment | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [addrText, setAddrText] = useState('');
  const [landmark, setLandmark] = useState('');
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [coords, setCoords] = useState<Position | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [method, setMethod] = useState<OrderPayMethod | null>(null);
  const [hmoProvider, setHmoProvider] = useState('');
  const [hmoMember, setHmoMember] = useState('');
  const [coTerms, setCoTerms] = useState(false);

  const orderRef = useRef<PharmacyOrder | null>(null);
  orderRef.current = order;

  const resetCheckout = useCallback(() => {
    setFulfilment(null);
    setExcluded([]);
    setAddrText('');
    setLandmark('');
    setRecipient('');
    setPhone('');
    setCoords(null);
    setPreview(null);
    setMethod(null);
    setHmoProvider('');
    setHmoMember('');
    setCoTerms(false);
  }, []);

  const resetRequest = useCallback(() => {
    setPharmacy(null);
    setItems([emptyItem()]);
    setFiles([]);
    setShareOk(false);
    setLinkOk(false);
    setTermsOk(false);
  }, []);

  const loadOrders = useCallback(async () => {
    setListLoading(true);
    try {
      setOrders(await pharmacyOrderService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your orders.');
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadPharmacies = useCallback(async (): Promise<OrderPharmacy[]> => {
    let here: Position | null = pos;
    if (!here) {
      const r = await getDevicePosition();
      if (r.ok) {
        here = r.pos;
        setPos(r.pos);
      }
    }
    const list = await pharmacyOrderService.pharmacies(here);
    setPharmacies(list);
    return list;
  }, [pos]);

  const openDetail = useCallback(async (id: string) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      setOrder(await pharmacyOrderService.get(id));
      setView('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the order.');
      setView('list');
    } finally {
      setBusy(false);
    }
  }, []);

  // Start fresh each time the screen opens.
  const facilityId = state.pharmacyOrderFacilityId;
  const openId = state.pharmacyOrderOpenId;
  useEffect(() => {
    if (!visible) return;
    setView('list');
    setError('');
    setInfo('');
    setOrder(null);
    resetRequest();
    resetCheckout();
    pharmacyOrderService.config().then(setConfig).catch(() => setConfig(null));
    void loadOrders();
    if (openId) {
      void openDetail(openId);
    } else if (facilityId) {
      setBusy(true);
      loadPharmacies()
        .then((list) => {
          const hit = list.find((p) => p.facilityId === facilityId);
          if (hit) {
            setPharmacy(hit);
            setView('request');
          } else {
            setError('This pharmacy is not taking orders on WelliRecord yet. Choose another one.');
            setView('pick');
          }
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Could not load pharmacies.');
          setView('pick');
        })
        .finally(() => setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, facilityId, openId]);

  // Keep an open order fresh while it is moving.
  useEffect(() => {
    if (!visible || view !== 'detail' || !order || TERMINAL.includes(order.status)) return;
    const id = order.id;
    const t = setInterval(() => {
      pharmacyOrderService.get(id).then((o) => {
        if (orderRef.current?.id === id) setOrder(o);
      }).catch(() => {});
    }, 20_000);
    return () => clearInterval(t);
  }, [visible, view, order?.id, order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const close = () => actions.closePharmacyOrders();
  const fail = (e: unknown, fallback: string) => setError(e instanceof Error && e.message ? e.message : fallback);

  const back = () => {
    setError('');
    setInfo('');
    if (view === 'pick') setView('list');
    else if (view === 'request') setView(pharmacies.length ? 'pick' : 'list');
    else if (view === 'detail') {
      setOrder(null);
      void loadOrders();
      setView('list');
    } else if (view === 'checkout') setView('detail');
  };

  // ----- new order -----

  const startNew = async () => {
    setError('');
    setBusy(true);
    try {
      await loadPharmacies();
      setView('pick');
    } catch (e) {
      fail(e, 'Could not load pharmacies.');
    } finally {
      setBusy(false);
    }
  };

  const addFile = async (kind: 'camera' | 'library' | 'pdf') => {
    setError('');
    if (!config || files.length >= config.maxAttachments) {
      setError(`You can add up to ${config?.maxAttachments ?? 3} files.`);
      return;
    }
    setBusy(true);
    try {
      let base64: string | undefined;
      let label = 'Photo';
      if (kind === 'pdf') {
        const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
        if (r.canceled || !r.assets?.length) return;
        base64 = await new File(r.assets[0].uri).base64();
        label = r.assets[0].name || 'Prescription.pdf';
      } else {
        const m = kind === 'camera' ? await pickImageFromCamera(false, 0.4) : await pickImageFromLibrary(false, 0.4);
        if (!m) {
          setError('The photo was not added. Check that WelliRecord can use your camera or photos.');
          return;
        }
        base64 = m.base64;
        label = m.name || 'Photo';
      }
      if (!base64) {
        setError('Could not read that file.');
        return;
      }
      if (Math.floor((base64.length * 3) / 4) > config.maxAttachmentBytes) {
        setError('That file is too large. Take the photo again from a bit further away, or choose a smaller file.');
        return;
      }
      const up = await pharmacyOrderService.uploadFile(base64);
      hapticFeedback.success();
      setFiles((f) => [...f, { id: up.id, contentType: up.contentType, label }]);
    } catch (e) {
      fail(e, 'Could not add the file.');
    } finally {
      setBusy(false);
    }
  };

  const setItem = (i: number, patch: Partial<DraftItem>) => setItems((list) => list.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const submitRequest = async () => {
    setError('');
    if (!pharmacy) return;
    const clean = items
      .filter((it) => it.name.trim())
      .map((it) => ({ name: it.name.trim(), strength: it.strength.trim(), quantity: Number(it.quantity), notes: it.notes.trim() }));
    if (!clean.length) return setError('Add at least one medication.');
    if (clean.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 999)) return setError('Quantity must be a whole number from 1 to 999.');
    if (files.length && !shareOk) return setError('Agree to share your prescription with the pharmacy to send it.');
    if (!termsOk) return setError('Accept the terms to continue.');
    setBusy(true);
    try {
      const o = await pharmacyOrderService.place({
        pharmacyId: pharmacy.facilityId,
        items: clean,
        attachmentIds: files.map((f) => f.id),
        consentShare: shareOk,
        linkToRecord: linkOk && files.length > 0,
      });
      hapticFeedback.success();
      resetRequest();
      setOrder(o);
      setInfo(`Sent to ${o.pharmacy.name}. The pharmacist will review it and send you a price.`);
      setView('detail');
      void loadOrders();
    } catch (e) {
      fail(e, 'Could not send the order.');
    } finally {
      setBusy(false);
    }
  };

  // ----- checkout -----

  const startCheckout = () => {
    if (!order) return;
    resetCheckout();
    setError('');
    setInfo('');
    setView('checkout');
  };

  const useMyLocation = async () => {
    setError('');
    const r = await getDevicePosition();
    if (r.ok) {
      setCoords(r.pos);
      setPreview(null);
      setInfo('Your location was added. It makes the delivery fee exact. Add the street address and a landmark too.');
    } else {
      setError('Could not get your location. Type the full address with a landmark instead.');
    }
  };

  const checkoutBody = () => ({
    fulfilment: fulfilment!,
    excluded,
    address:
      fulfilment === 'delivery'
        ? { text: addrText.trim(), landmark: landmark.trim(), recipientName: recipient.trim(), recipientPhone: phone.trim(), ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) }
        : undefined,
  });

  const calcTotal = async () => {
    if (!order || !fulfilment) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const p = await pharmacyOrderService.preview(order.id, checkoutBody());
      setPreview(p);
      if (method && !p.methods.includes(method) && method !== 'hmo') setMethod(null);
    } catch (e) {
      setPreview(null);
      fail(e, 'Could not work out the total.');
    } finally {
      setBusy(false);
    }
  };

  const confirmOrder = async () => {
    if (!order || !fulfilment || !preview || !method) return;
    setError('');
    if (!coTerms) return setError('Accept the terms to continue.');
    if (method === 'hmo' && !hmoProvider) return setError('Choose your HMO.');
    setBusy(true);
    try {
      const r = await pharmacyOrderService.checkout(order.id, {
        ...checkoutBody(),
        paymentMethod: method,
        hmo: method === 'hmo' ? { provider: hmoProvider, memberId: hmoMember.trim() } : undefined,
      });
      hapticFeedback.success();
      setOrder(r.order);
      setInfo(r.notice);
      setView('detail');
      if (r.authorizationUrl) await payOnline(r.order.id, r.authorizationUrl);
      void loadOrders();
    } catch (e) {
      fail(e, 'Could not complete checkout.');
    } finally {
      setBusy(false);
    }
  };

  const payOnline = async (id: string, url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError('Could not open the payment page. Tap Pay now to try again.');
      return;
    }
    // The payment provider tells the server; ask the server a few times for the result.
    for (let i = 0; i < 5; i++) {
      try {
        const o = await pharmacyOrderService.get(id);
        setOrder(o);
        if (o.status !== 'awaiting_payment') break;
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const payNow = async () => {
    if (!order) return;
    setError('');
    setBusy(true);
    try {
      const r = await pharmacyOrderService.pay(order.id);
      setOrder(r.order);
      await payOnline(r.order.id, r.authorizationUrl);
    } catch (e) {
      fail(e, 'Could not start the payment.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!order) return;
    setError('');
    setBusy(true);
    try {
      setOrder(await pharmacyOrderService.get(order.id));
    } catch (e) {
      fail(e, 'Could not refresh.');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = () => {
    if (!order) return;
    Alert.alert('Cancel this order?', order.paymentStatus === 'paid' ? 'You have paid. The pharmacy decides about a refund.' : 'The pharmacy will be told.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            setOrder(await pharmacyOrderService.cancel(order.id));
            void loadOrders();
          } catch (e) {
            fail(e, 'Could not cancel the order.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // ----- views -----

  const header = (
    <View className="min-h-[44px] flex-row items-center justify-between">
      {view === 'list' ? (
        <View className="h-11 w-11" />
      ) : (
        <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-slate-50">
          <Text className="text-[22px] text-[#315B90]">‹</Text>
        </TouchableOpacity>
      )}
      <Text className="text-[12px] font-semibold text-slate-800">Pharmacy</Text>
      <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close" className="h-11 w-11 items-center justify-center rounded-full bg-slate-50">
        <Text className="text-[16px] text-slate-500">✕</Text>
      </TouchableOpacity>
    </View>
  );

  const title = (t: string, sub?: string) => (
    <View className="mt-3">
      <Text className="text-[24px] leading-[30px] font-extrabold text-[#082F67]">{t}</Text>
      {sub ? <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">{sub}</Text> : null}
    </View>
  );

  const renderList = () => (
    <>
      {title('Medication orders', 'Send a prescription to a pharmacy, get a price, then choose delivery or pickup.')}
      <Primary label="Order medication" onPress={startNew} busy={busy} />
      {listLoading && !orders.length ? <ActivityIndicator className="mt-6" color={BLUE} /> : null}
      {!listLoading && !orders.length ? (
        <Box>
          <Text className="text-[13px] leading-[19px] text-slate-600">You have no orders yet.</Text>
        </Box>
      ) : null}
      {orders.map((o) => (
        <TouchableOpacity key={o.id} onPress={() => void openDetail(o.id)} accessibilityRole="button" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-[14px] font-bold text-[#173B68]">{o.pharmacy.name}</Text>
            <Text className={`ml-2 text-[11.5px] font-bold ${ORDER_OPEN.includes(o.status) ? 'text-[#315B90]' : 'text-slate-500'}`}>{STATUS_LABEL[o.status]}</Text>
          </View>
          <Text className="mt-1 text-[12px] text-slate-500">
            Ref {o.ref} · {o.items.map((i) => i.name).join(', ')}
          </Text>
          {o.totalMinor > 0 ? <Text className="mt-1 text-[12px] font-semibold text-slate-700">{formatMinor(o.totalMinor, o.currency)}</Text> : null}
        </TouchableOpacity>
      ))}
    </>
  );

  const renderPick = () => (
    <>
      {title('Choose a pharmacy', pos ? 'Sorted by distance from you.' : 'Location is off, so distances are not shown.')}
      {!pharmacies.length ? (
        <Box>
          <Text className="text-[13px] leading-[19px] text-slate-600">No pharmacy is taking orders on WelliRecord yet. You can still find pharmacies on the map under Care.</Text>
        </Box>
      ) : null}
      {pharmacies.map((p) => (
        <TouchableOpacity
          key={p.facilityId}
          onPress={() => {
            setPharmacy(p);
            setError('');
            setView('request');
          }}
          accessibilityRole="button"
          className="mt-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <View className="flex-row items-center">
            <Text className="flex-shrink text-[14px] font-bold text-[#173B68]">{p.name}</Text>
            {p.verified ? <View className="ml-2"><WelliBadge /></View> : null}
          </View>
          <Text className="mt-1 text-[12px] text-slate-500">{[p.address, p.distanceKm != null ? formatDistance(p.distanceKm) : ''].filter(Boolean).join(' · ')}</Text>
          <Text className="mt-2 text-[12px] leading-[18px] text-slate-700">
            {p.deliveryAvailable
              ? `Delivers${p.deliveryFromMinor != null ? ` from ${formatMinor(p.deliveryFromMinor)}` : ''}${p.deliveryEta ? ` · ${p.deliveryEta}` : ''}`
              : 'No delivery to your location'}
            {p.pickupAvailable ? ' · Pickup' : ''}
          </Text>
          <Text className="mt-1 text-[11.5px] text-slate-500">
            {[p.onlinePayment ? 'Online' : '', p.payOnDelivery ? 'On delivery' : '', p.payAtPickup ? 'At pickup' : '', p.acceptsHmo.length ? 'HMO' : ''].filter(Boolean).join(' · ')}
          </Text>
        </TouchableOpacity>
      ))}
    </>
  );

  const renderRequest = () =>
    pharmacy ? (
      <>
        {title('Your order', `To ${pharmacy.name}. You pay only after you accept the price.`)}

        <Text className="mt-5 text-[13px] font-bold text-[#173B68]">Medication</Text>
        {items.map((it, i) => (
          <Box key={i}>
            <Text className="text-[11.5px] font-semibold text-slate-500">Medicine name</Text>
            <TextInput value={it.name} onChangeText={(v) => setItem(i, { name: v })} placeholder="For example, Amoxicillin" maxLength={120} className={input} accessibilityLabel={`Medicine ${i + 1} name`} />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mt-2 text-[11.5px] font-semibold text-slate-500">Strength</Text>
                <TextInput value={it.strength} onChangeText={(v) => setItem(i, { strength: v })} placeholder="500mg" maxLength={60} className={input} accessibilityLabel={`Medicine ${i + 1} strength`} />
              </View>
              <View className="w-24">
                <Text className="mt-2 text-[11.5px] font-semibold text-slate-500">Quantity</Text>
                <TextInput value={it.quantity} onChangeText={(v) => setItem(i, { quantity: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={3} className={input} accessibilityLabel={`Medicine ${i + 1} quantity`} />
              </View>
            </View>
            {items.length > 1 ? (
              <TouchableOpacity onPress={() => setItems((l) => l.filter((_, k) => k !== i))} accessibilityRole="button" className="mt-2 min-h-[44px] justify-center">
                <Text className="text-[12.5px] font-semibold text-red-700">Remove</Text>
              </TouchableOpacity>
            ) : null}
          </Box>
        ))}
        {items.length < MAX_ITEMS ? (
          <TouchableOpacity onPress={() => setItems((l) => [...l, emptyItem()])} accessibilityRole="button" className="mt-2 min-h-[44px] justify-center">
            <Text className="text-[13px] font-semibold text-[#315B90]">+ Add another medicine</Text>
          </TouchableOpacity>
        ) : null}

        <Text className="mt-5 text-[13px] font-bold text-[#173B68]">Prescription or medical report</Text>
        <Text className="mt-1 text-[12px] leading-[18px] text-slate-500">
          Take a clear photo or add a PDF. Only {pharmacy.name} can see it. It is kept for 30 days after the order ends, then deleted. It is never sent to another service.
        </Text>
        {files.map((f) => (
          <View key={f.id} className="mt-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Text className="flex-1 text-[12.5px] text-slate-700" numberOfLines={1}>{f.label}</Text>
            <TouchableOpacity onPress={() => setFiles((l) => l.filter((x) => x.id !== f.id))} accessibilityRole="button" accessibilityLabel={`Remove ${f.label}`} className="h-11 justify-center pl-3">
              <Text className="text-[12.5px] font-semibold text-red-700">Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Chip label="Take photo" onPress={() => void addFile('camera')} disabled={busy} />
          <Chip label="Choose photo" onPress={() => void addFile('library')} disabled={busy} />
          <Chip label="Add PDF" onPress={() => void addFile('pdf')} disabled={busy} />
        </View>

        {files.length ? (
          <>
            <Check on={shareOk} onPress={() => setShareOk((v) => !v)} label={`I agree to share this prescription with ${pharmacy.name} so they can review my order.`} />
            <Check on={linkOk} onPress={() => setLinkOk((v) => !v)} label="Add the medication to my WelliRecord medication list once it is delivered (optional)." />
          </>
        ) : (
          <Text className="mt-3 text-[12px] leading-[18px] text-amber-800">Most medicines need a prescription. The pharmacist may ask for one before they can fill the order.</Text>
        )}
        <Check on={termsOk} onPress={() => setTermsOk((v) => !v)} label="I accept the ordering terms below." />
        {config ? (
          <View className="mt-2">
            {config.terms.map((t, i) => (
              <Text key={i} className="mt-1 text-[11.5px] leading-[17px] text-slate-500">• {t}</Text>
            ))}
          </View>
        ) : null}
        <Primary label="Send order to pharmacy" onPress={submitRequest} busy={busy} />
      </>
    ) : null;

  const renderDetail = () => {
    if (!order) return null;
    const o = order;
    const ended = o.step < 0;
    const code = o.handoverCode;
    const showCode = !!code && ['confirmed', 'dispatched', 'ready_for_pickup'].includes(o.status);
    const cancellable = ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo', 'confirmed', 'ready_for_pickup'].includes(o.status);
    return (
      <>
        {title(STATUS_LABEL[o.status], `${o.pharmacy.name} · ref ${o.ref}`)}
        {info ? <Box tone="note"><Text className="text-[12.5px] leading-[18px] text-amber-900">{info}</Text></Box> : null}

        {ended ? (
          <Box tone={o.status === 'expired' ? 'note' : 'plain'}>
            <Text className="text-[13px] leading-[19px] text-slate-700">
              {o.status === 'rejected' ? `The pharmacy could not fill this order: ${o.cancelReason}` : o.status === 'expired' ? 'The price ran out of time. Send a new order to get a fresh price.' : `Order cancelled${o.cancelReason ? `: ${o.cancelReason}` : '.'}`}
            </Text>
            {o.paymentStatus === 'refund_due' ? <Text className="mt-2 text-[12.5px] font-semibold text-slate-800">You paid for this order. The pharmacy will arrange your refund.</Text> : null}
          </Box>
        ) : (
          <View className="mt-4">
            {o.timeline.map((label, i) => {
              const done = i <= o.step;
              return (
                <View key={label} className="min-h-[34px] flex-row items-center">
                  <View className={`h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-[#315B90]' : 'border border-slate-300 bg-white'}`}>
                    {done ? <Text className="text-[11px] font-bold text-white">✓</Text> : null}
                  </View>
                  <Text className={`ml-3 text-[13px] ${done ? 'font-semibold text-[#173B68]' : 'text-slate-400'}`}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {showCode ? (
          <Box>
            <Text className="text-[11.5px] font-semibold text-slate-500">Your handover code</Text>
            <Text className="mt-1 text-[32px] font-extrabold tracking-[6px] text-[#082F67]" accessibilityLabel={`Handover code ${code!.split('').join(' ')}`}>{code}</Text>
            <Text className="mt-2 text-[12px] leading-[18px] text-slate-600">
              {o.fulfilment === 'pickup' ? 'Show this code at the counter when you collect.' : 'Give this code to the rider only when you have your medication in hand.'}
            </Text>
          </Box>
        ) : null}

        {o.dispatch?.riderName ? (
          <Box>
            <Text className="text-[13px] font-bold text-[#173B68]">Your rider</Text>
            <Text className="mt-1 text-[13px] text-slate-700">{o.dispatch.riderName}{o.dispatch.riderPhone ? ` · ${o.dispatch.riderPhone}` : ''}</Text>
            {o.dispatch.etaNote ? <Text className="mt-1 text-[12px] text-slate-500">{o.dispatch.etaNote}</Text> : null}
          </Box>
        ) : null}

        <Box>
          <Text className="text-[13px] font-bold text-[#173B68]">{o.quote ? 'Price' : 'What you asked for'}</Text>
          {o.quote
            ? o.quote.lines.map((l) => (
                <View key={l.index} className="mt-2 flex-row justify-between">
                  <Text className={`flex-1 pr-3 text-[12.5px] ${l.available ? 'text-slate-700' : 'text-slate-400'}`}>
                    {l.name}{l.strength ? ` ${l.strength}` : ''} × {l.quantity}{l.alternative ? ' (alternative)' : ''}{!l.available ? ' (not available)' : ''}
                  </Text>
                  <Text className={`text-[12.5px] ${o.excluded.includes(l.index) ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{l.available ? formatMinor(l.unitPriceMinor * l.quantity, o.currency) : ''}</Text>
                </View>
              ))
            : o.items.map((i, k) => (
                <Text key={k} className="mt-2 text-[12.5px] text-slate-700">{i.name}{i.strength ? ` ${i.strength}` : ''} × {i.quantity}</Text>
              ))}
          {o.quote?.note ? <Text className="mt-3 text-[12px] leading-[18px] text-slate-600">Pharmacist: {o.quote.note}</Text> : null}
          {o.totalMinor > 0 ? (
            <View className="mt-3 border-t border-slate-200 pt-3">
              <View className="flex-row justify-between"><Text className="text-[12.5px] text-slate-600">Medication</Text><Text className="text-[12.5px] text-slate-700">{formatMinor(o.medsMinor, o.currency)}</Text></View>
              {o.fulfilment === 'delivery' ? <View className="mt-1 flex-row justify-between"><Text className="text-[12.5px] text-slate-600">Delivery{o.distanceKm != null ? ` (${formatDistance(o.distanceKm)})` : ''}</Text><Text className="text-[12.5px] text-slate-700">{formatMinor(o.deliveryFeeMinor, o.currency)}</Text></View> : null}
              <View className="mt-1 flex-row justify-between"><Text className="text-[13px] font-bold text-[#173B68]">Total</Text><Text className="text-[13px] font-bold text-[#173B68]">{formatMinor(o.totalMinor, o.currency)}</Text></View>
              {o.hmo?.coveredMinor ? <View className="mt-1 flex-row justify-between"><Text className="text-[12.5px] text-slate-600">Covered by {o.hmo.provider}</Text><Text className="text-[12.5px] text-slate-700">{formatMinor(o.hmo.coveredMinor, o.currency)}</Text></View> : null}
              {o.dueMinor !== o.totalMinor ? <View className="mt-1 flex-row justify-between"><Text className="text-[12.5px] text-slate-600">You pay</Text><Text className="text-[12.5px] font-semibold text-slate-800">{formatMinor(o.dueMinor, o.currency)}</Text></View> : null}
            </View>
          ) : null}
        </Box>

        {o.address ? (
          <Box>
            <Text className="text-[13px] font-bold text-[#173B68]">{o.fulfilment === 'delivery' ? 'Delivery address' : 'Pickup'}</Text>
            <Text className="mt-1 text-[12.5px] leading-[18px] text-slate-700">{o.address.text}{o.address.landmark ? ` (near ${o.address.landmark})` : ''}</Text>
          </Box>
        ) : null}
        {o.fulfilment === 'pickup' ? <Box><Text className="text-[12.5px] text-slate-700">Pickup at {o.pharmacy.name}{o.pharmacy.address ? `, ${o.pharmacy.address}` : ''}</Text></Box> : null}

        {o.status === 'quoted' ? <Primary label="Continue to delivery and payment" onPress={startCheckout} /> : null}
        {o.status === 'awaiting_payment' && o.dueMinor > 0 ? <Primary label={`Pay ${formatMinor(o.dueMinor, o.currency)} now`} onPress={payNow} busy={busy} /> : null}
        {o.status === 'awaiting_hmo' ? <Text className="mt-3 text-[12px] leading-[18px] text-slate-500">The pharmacy is confirming your HMO cover. We will tell you when it is done.</Text> : null}
        {o.status === 'awaiting_review' ? <Text className="mt-3 text-[12px] leading-[18px] text-slate-500">The pharmacist checks your prescription and stock, then sends a price. You pay nothing until you accept it.</Text> : null}
        {!TERMINAL.includes(o.status) ? (
          <TouchableOpacity onPress={refresh} disabled={busy} accessibilityRole="button" className="mt-4 min-h-[44px] items-center justify-center">
            <Text className="text-[13px] font-semibold text-[#315B90]">Refresh status</Text>
          </TouchableOpacity>
        ) : null}
        {cancellable ? (
          <TouchableOpacity onPress={cancelOrder} disabled={busy} accessibilityRole="button" className="min-h-[44px] items-center justify-center">
            <Text className="text-[13px] font-semibold text-red-700">Cancel order</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  const renderCheckout = () => {
    if (!order) return null;
    const alts = (order.quote?.lines || []).filter((l) => l.alternative && l.available);
    const svc = pharmacies.find((p) => p.facilityId === order.pharmacy.id);
    const canDeliver = svc ? svc.deliveryAvailable || svc.deliveryFromMinor != null : true;
    const canPickup = svc ? svc.pickupAvailable : true;
    const addressReady = addrText.trim().length >= 8 && phone.trim().length >= 8;
    const canCalc = !!fulfilment && (fulfilment === 'pickup' || addressReady);
    const methods = preview?.methods || [];
    const hmoList = preview?.hmo || [];
    return (
      <>
        {title('Delivery and payment', `${order.pharmacy.name} · ref ${order.ref}`)}
        {info ? <Box tone="note"><Text className="text-[12.5px] leading-[18px] text-amber-900">{info}</Text></Box> : null}

        {alts.length ? (
          <>
            <Text className="mt-5 text-[13px] font-bold text-[#173B68]">Alternatives the pharmacist suggested</Text>
            {alts.map((l) => (
              <Check
                key={l.index}
                on={!excluded.includes(l.index)}
                onPress={() => {
                  setExcluded((e) => (e.includes(l.index) ? e.filter((x) => x !== l.index) : [...e, l.index]));
                  setPreview(null);
                }}
                label={`${l.name}${l.strength ? ` ${l.strength}` : ''} × ${l.quantity} · ${formatMinor(l.unitPriceMinor * l.quantity)}${l.note ? ` · ${l.note}` : ''}`}
              />
            ))}
          </>
        ) : null}

        <Text className="mt-5 text-[13px] font-bold text-[#173B68]">How do you want it?</Text>
        <View className="mt-2 flex-row gap-2">
          <Chip on={fulfilment === 'delivery'} label="Delivery" disabled={!canDeliver} onPress={() => { setFulfilment('delivery'); setPreview(null); setMethod(null); }} />
          <Chip on={fulfilment === 'pickup'} label="Pickup" disabled={!canPickup} onPress={() => { setFulfilment('pickup'); setPreview(null); setMethod(null); }} />
        </View>

        {fulfilment === 'delivery' ? (
          <Box>
            <Text className="text-[11.5px] font-semibold text-slate-500">Delivery address</Text>
            <TextInput value={addrText} onChangeText={(v) => { setAddrText(v); setPreview(null); }} placeholder="House number, street, area, city" multiline maxLength={300} className={`${input} py-2`} accessibilityLabel="Delivery address" />
            <Text className="mt-2 text-[11.5px] font-semibold text-slate-500">Landmark</Text>
            <TextInput value={landmark} onChangeText={setLandmark} placeholder="Near a church, bank, junction" maxLength={120} className={input} accessibilityLabel="Landmark" />
            <Text className="mt-2 text-[11.5px] font-semibold text-slate-500">Who receives it</Text>
            <TextInput value={recipient} onChangeText={setRecipient} placeholder="Name" maxLength={80} className={input} accessibilityLabel="Recipient name" />
            <Text className="mt-2 text-[11.5px] font-semibold text-slate-500">Phone number of the person receiving it</Text>
            <TextInput value={phone} onChangeText={(v) => { setPhone(v); setPreview(null); }} placeholder="0803 123 4567" keyboardType="phone-pad" maxLength={20} className={input} accessibilityLabel="Recipient phone number" />
            <TouchableOpacity onPress={useMyLocation} accessibilityRole="button" className="mt-3 min-h-[44px] justify-center">
              <Text className="text-[13px] font-semibold text-[#315B90]">{coords ? '✓ Location added. Tap to update' : 'Add my current location for an exact fee'}</Text>
            </TouchableOpacity>
          </Box>
        ) : null}

        {fulfilment ? <Primary label={preview ? 'Update total' : fulfilment === 'delivery' ? 'Calculate delivery fee and total' : 'See total'} onPress={calcTotal} busy={busy} disabled={!canCalc} /> : null}

        {preview ? (
          <>
            <Box>
              <View className="flex-row justify-between"><Text className="text-[12.5px] text-slate-600">Medication</Text><Text className="text-[12.5px] text-slate-700">{formatMinor(preview.medsMinor)}</Text></View>
              {fulfilment === 'delivery' ? (
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-[12.5px] text-slate-600">Delivery{preview.distanceKm != null ? ` (${formatDistance(preview.distanceKm)})` : ''}{preview.feeEstimated ? ', estimate' : ''}</Text>
                  <Text className="text-[12.5px] text-slate-700">{formatMinor(preview.deliveryFeeMinor)}</Text>
                </View>
              ) : null}
              <View className="mt-2 flex-row justify-between border-t border-slate-200 pt-2"><Text className="text-[14px] font-bold text-[#173B68]">Total</Text><Text className="text-[14px] font-bold text-[#173B68]">{formatMinor(preview.totalMinor)}</Text></View>
              {preview.feeEstimated ? <Text className="mt-2 text-[11.5px] leading-[17px] text-amber-800">Add your location to get the exact delivery fee. This uses the pharmacy&apos;s highest fee.</Text> : null}
              {preview.eta ? <Text className="mt-2 text-[11.5px] text-slate-500">Delivery time: {preview.eta}</Text> : null}
            </Box>

            <Text className="mt-5 text-[13px] font-bold text-[#173B68]">How do you want to pay?</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {methods.map((m) => <Chip key={m} on={method === m} label={PAY_LABEL[m]} onPress={() => setMethod(m)} />)}
              {hmoList.length ? <Chip on={method === 'hmo'} label={PAY_LABEL.hmo} onPress={() => setMethod('hmo')} /> : null}
            </View>
            {!methods.length && !hmoList.length ? <Text className="mt-2 text-[12px] text-red-700">This pharmacy has no payment option for this choice. Try {fulfilment === 'delivery' ? 'pickup' : 'delivery'}.</Text> : null}

            {method === 'hmo' ? (
              <Box>
                <Text className="text-[11.5px] font-semibold text-slate-500">Your HMO</Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {hmoList.map((h) => <Chip key={h} on={hmoProvider === h} label={h} onPress={() => setHmoProvider(h)} />)}
                </View>
                <Text className="mt-3 text-[11.5px] font-semibold text-slate-500">Member or policy number</Text>
                <TextInput value={hmoMember} onChangeText={setHmoMember} maxLength={60} autoCapitalize="characters" className={input} accessibilityLabel="HMO member number" />
                <Text className="mt-2 text-[11.5px] leading-[17px] text-slate-500">The pharmacy confirms your cover before the order goes ahead. Any balance is paid another way.</Text>
              </Box>
            ) : null}
            {method === 'online' ? <Text className="mt-3 text-[12px] leading-[18px] text-slate-500">The order goes ahead only after the payment succeeds.</Text> : null}

            {method ? (
              <>
                <Check on={coTerms} onPress={() => setCoTerms((v) => !v)} label="I accept the ordering terms and the total shown above." />
                <Primary label={method === 'online' ? `Pay ${formatMinor(preview.totalMinor)}` : 'Confirm order'} onPress={confirmOrder} busy={busy} />
              </>
            ) : null}
          </>
        ) : null}
      </>
    );
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {header}
          {error ? (
            <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3" accessibilityRole="alert">
              <Text className="text-[12.5px] leading-[18px] text-red-800">{error}</Text>
            </View>
          ) : null}
          {busy && view !== 'request' && view !== 'checkout' && view !== 'detail' && view !== 'list' ? <ActivityIndicator className="mt-6" color={BLUE} /> : null}
          {view === 'list' ? renderList() : null}
          {view === 'pick' ? renderPick() : null}
          {view === 'request' ? renderRequest() : null}
          {view === 'detail' ? renderDetail() : null}
          {view === 'checkout' ? renderCheckout() : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
