import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Crypto from 'expo-crypto';
import { linkWithKey, sealRecord } from '../utils/sealedShare';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';
import {
  providerShareService, type ProviderShare, type ShareSection,
} from '../services/providerShareService';

const ACCENT = '#0f766e';
const SECTION_LABELS: Record<ShareSection, string> = {
  allergies: 'Allergies, blood group and genotype',
  conditions: 'Conditions',
  medications: 'Medications',
  records: 'Records and lab results (no files)',
  vaccinations: 'Vaccines',
  growth: 'Growth measurements',
};
const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

const when = (iso: string) => new Date(iso).toLocaleString();

export function ProviderShareModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const theme = useTheme();
  const [view, setView] = useState<'list' | 'new' | 'done'>('list');
  const [shares, setShares] = useState<ProviderShare[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('me');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [sections, setSections] = useState<ShareSection[]>(['allergies', 'medications']);
  const [hours, setHours] = useState(24);
  const [mode, setMode] = useState<'email' | 'sms' | 'passcode'>('email');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; passcode?: string; expiresAt: string; name: string } | null>(null);
  const draft = state.providerShareDraft;

  const subject = family.find((f) => f.id === subjectId) || family[0];
  const isChild = Boolean(subject) && subject.role === 'dependent' && subject.id !== 'me';
  const choices = (Object.keys(SECTION_LABELS) as ShareSection[]).filter(
    (s) => isChild || (s !== 'vaccinations' && s !== 'growth')
  );

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setShares(await providerShareService.list());
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load shared links');
    }
  }, []);

  useEffect(() => {
    if (state.showProviderShare) load();
  }, [state.showProviderShare, load]);

  // Opened from a record or from consent: start on the new-link form with that choice filled in.
  useEffect(() => {
    if (!state.showProviderShare) return;
    if (draft) {
      if (draft.subjectId) setSubjectId(draft.subjectId);
      if (draft.sections?.length) setSections(draft.sections);
      setResult(null);
      setView('new');
    } else {
      setView('list');
    }
  }, [state.showProviderShare, draft]);

  if (!state.showProviderShare) return null;

  const toggle = (s: ShareSection) =>
    setSections((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const create = async () => {
    if (name.trim().length < 2) return Alert.alert('Provider', 'Enter the name of the doctor or clinic.');
    const picked = sections.filter((s) => choices.includes(s));
    if (!picked.length) return Alert.alert('What to share', 'Choose at least one thing to share.');
    if (mode !== 'passcode' && !contact.trim()) {
      return Alert.alert('Code delivery', mode === 'email' ? "Enter the provider's email address." : "Enter the provider's mobile number.");
    }
    setBusy(true);
    try {
      // Encrypt on this phone. The key goes only into the link and QR, after the '#', so our server
      // stores ciphertext and never receives the key.
      const snap = await providerShareService.snapshot({ subjectId, sections: picked, purpose: purpose.trim() || undefined, recordIds: draft?.recordIds?.length && picked.includes('records') ? draft.recordIds : undefined });
      const sealed = sealRecord(snap.record, (n) => Crypto.getRandomBytes(n));
      const r = await providerShareService.create({
        subjectId, recipientName: name.trim(), purpose: purpose.trim() || undefined, sections: snap.sections, hours,
        verification: mode === 'passcode' ? { mode: 'passcode' } : { mode: 'contact', channel: mode, contact: contact.trim() },
        sealed: { ciphertext: sealed.ciphertext, iv: sealed.iv },
      });
      setResult({ url: linkWithKey(r.url, sealed.key), passcode: r.passcode, expiresAt: r.share.expiresAt, name: name.trim() });
      setView('done');
      setName(''); setPurpose(''); setContact('');
      load();
    } catch (e: any) {
      Alert.alert('Could not create the link', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = (s: ProviderShare) =>
    Alert.alert('Withdraw this link?', `${s.recipientName} will no longer be able to open it.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive',
        onPress: async () => {
          try { await providerShareService.revoke(s.id); load(); }
          catch (e: any) { Alert.alert('Could not withdraw', e?.message || 'Try again.'); }
        },
      },
    ]);

  const sendLink = () => {
    if (!result) return;
    Share.share({ message: `Health information shared with ${result.name} through WelliRecord. This link contains the key to open it, so send it only to them. Open: ${result.url}` }).catch(() => {});
  };

  const text = { color: theme.text } as const;
  const muted = { color: theme.muted } as const;
  const card = { backgroundColor: theme.surface, borderColor: theme.border } as const;

  return (
    <Modal visible animationType="slide" onRequestClose={actions.closeProviderShare}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <ModalHeader
          title="Share with a provider"
          onClose={actions.closeProviderShare}
          showBack={view !== 'list'}
          onBack={() => setView('list')}
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {view === 'list' && (
            <>
              <Text style={[s.body, muted]}>
                Give a doctor or clinic that does not use WelliRecord a link or QR code. Your phone encrypts what you choose to share. The key is inside the link and QR code and never reaches our servers, which hold only the encrypted copy. The provider also needs a one-time code. The link expires and you can withdraw it any time. It shows the record as it is when you create the link.
              </Text>
              <TouchableOpacity style={s.primary} onPress={() => setView('new')} accessibilityRole="button">
                <Text style={s.primaryText}>Create a link</Text>
              </TouchableOpacity>
              <Text style={[s.h, text]}>Your links</Text>
              {loadError && <Text style={s.err}>{loadError}</Text>}
              {!shares && !loadError && <ActivityIndicator color={ACCENT} />}
              {shares && !shares.length && <Text style={muted}>You have not shared anything yet.</Text>}
              {shares?.map((x) => (
                <View key={x.id} style={[s.card, card]}>
                  <Text style={[s.title, text]}>{x.recipientName}</Text>
                  <Text style={muted}>
                    {x.state === 'active' ? `Expires ${when(x.expiresAt)}` : x.state === 'expired' ? `Expired ${when(x.expiresAt)}` : x.state === 'revoked' ? 'Withdrawn' : 'Locked after wrong codes'}
                  </Text>
                  <Text style={muted}>
                    {x.openedCount ? `Opened ${x.openedCount} time${x.openedCount === 1 ? '' : 's'}, last ${when(x.lastOpenedAt as string)}` : 'Not opened yet'}
                  </Text>
                  <Text style={muted}>{x.mode === 'passcode' ? 'Passcode you gave them' : `Code to ${x.contact}`}</Text>
                  {x.state === 'active' && (
                    <TouchableOpacity onPress={() => revoke(x)} accessibilityRole="button" style={{ marginTop: 8 }}>
                      <Text style={s.danger}>Withdraw link</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          {view === 'new' && (
            <>
              {draft?.recordIds?.length ? (
                <View style={[s.card, card, { marginBottom: 12 }]}>
                  <Text style={[s.h, text, { marginTop: 0 }]}>Sharing one result</Text>
                  <Text style={[s.small, muted]}>
                    Only {draft.label ? `"${draft.label}"` : 'this record'} is included, as text. The file or scan itself is never sent. Anyone with the link and the code can read it until it expires, or until you withdraw it.
                  </Text>
                </View>
              ) : null}
              {family.length > 1 && (
                <>
                  <Text style={[s.h, text]}>Whose record</Text>
                  <View style={s.wrap}>
                    {family.map((f) => (
                      <TouchableOpacity key={f.id} onPress={() => setSubjectId(f.id)} style={[s.chip, subjectId === f.id && s.chipOn]}>
                        <Text style={[s.chipText, subjectId === f.id && { color: '#fff' }]}>{f.id === 'me' || f.role === 'owner' ? 'Me' : f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <Text style={[s.h, text]}>Who is it for</Text>
              <TextInput style={[s.input, card, text]} value={name} onChangeText={setName} placeholder="Doctor or clinic name" placeholderTextColor={theme.mutedLight} maxLength={120} />
              <TextInput style={[s.input, card, text]} value={purpose} onChangeText={setPurpose} placeholder="Reason (optional)" placeholderTextColor={theme.mutedLight} maxLength={200} />

              <Text style={[s.h, text]}>What to share</Text>
              <Text style={[s.small, muted]}>Name, date of birth, sex and WelliID are always included. Scans and documents are never included.</Text>
              {choices.map((c) => (
                <TouchableOpacity key={c} style={[s.row, card]} onPress={() => toggle(c)} accessibilityRole="checkbox" accessibilityState={{ checked: sections.includes(c) }}>
                  <View style={[s.box, sections.includes(c) && s.boxOn]}>{sections.includes(c) && <Text style={s.tick}>✓</Text>}</View>
                  <Text style={[s.rowText, text]}>{SECTION_LABELS[c]}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[s.h, text]}>Link works for</Text>
              <View style={s.wrap}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity key={d.hours} onPress={() => setHours(d.hours)} style={[s.chip, hours === d.hours && s.chipOn]}>
                    <Text style={[s.chipText, hours === d.hours && { color: '#fff' }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.h, text]}>How the provider gets the code</Text>
              <View style={s.wrap}>
                {([['email', 'Email'], ['sms', 'SMS'], ['passcode', 'I will tell them']] as const).map(([k, l]) => (
                  <TouchableOpacity key={k} onPress={() => setMode(k)} style={[s.chip, mode === k && s.chipOn]}>
                    <Text style={[s.chipText, mode === k && { color: '#fff' }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {mode === 'passcode' ? (
                <Text style={[s.small, muted]}>You get a 6-digit passcode after creating the link. Tell it to the provider yourself, not in the same message as the link.</Text>
              ) : (
                <TextInput
                  style={[s.input, card, text]} value={contact} onChangeText={setContact}
                  placeholder={mode === 'email' ? "Provider's email" : "Provider's mobile, 080..."}
                  placeholderTextColor={theme.mutedLight} autoCapitalize="none"
                  keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
                />
              )}
              <TouchableOpacity style={[s.primary, busy && { opacity: 0.6 }]} onPress={create} disabled={busy} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Create link</Text>}
              </TouchableOpacity>
            </>
          )}

          {view === 'done' && result && (
            <View style={{ alignItems: 'center' }}>
              <Text style={[s.title, text]}>Ready for {result.name}</Text>
              <Text style={[s.small, muted, { textAlign: 'center' }]}>Works until {when(result.expiresAt)}</Text>
              <View style={s.qr}><QRCode value={result.url} size={200} color="#041E42" backgroundColor="#ffffff" /></View>
              {result.passcode ? (
                <View style={[s.card, card, { alignSelf: 'stretch', alignItems: 'center' }]}>
                  <Text style={muted}>Passcode. Shown once.</Text>
                  <Text style={[s.passcode, text]} selectable>{result.passcode}</Text>
                  <Text style={[s.small, muted, { textAlign: 'center' }]}>Tell this to the provider. They need it to open the link.</Text>
                </View>
              ) : (
                <Text style={[s.small, muted, { textAlign: 'center' }]}>The provider asks for a code on the page and we send it to the contact you entered.</Text>
              )}
              <TouchableOpacity style={s.primary} onPress={sendLink} accessibilityRole="button">
                <Text style={s.primaryText}>Send the link</Text>
              </TouchableOpacity>
              <Text style={[s.small, muted, { textAlign: 'center', marginTop: 12 }]}>Encrypted on your phone. Anyone with this link or QR code and the one-time code can open the record until it expires or you withdraw it, so share it only with the provider.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  err: { color: '#b91c1c', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10, gap: 2 },
  primary: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  danger: { color: '#b91c1c', fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: ACCENT, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: ACCENT },
  chipText: { color: ACCENT, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8, gap: 10 },
  rowText: { flex: 1, fontSize: 15 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: ACCENT },
  tick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  qr: { backgroundColor: '#fff', padding: 14, borderRadius: 16, marginVertical: 16 },
  passcode: { fontSize: 34, fontWeight: '800', letterSpacing: 6, marginVertical: 6 },
});
