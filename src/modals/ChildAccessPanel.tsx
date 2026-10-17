import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  GUARDIAN_RELATIONSHIPS,
  PERMISSION_LABELS,
  RELATIONSHIP_LABEL,
  childHealthService,
  type AuditEntry,
  type Guardian,
  type GuardiansResponse,
} from '../services/childHealthService';

const ACTION_LABEL: Record<string, string> = {
  profile_viewed: 'Viewed the profile',
  records_viewed: 'Viewed health records',
  details_updated: 'Updated details',
  vaccination_added: 'Recorded a vaccine',
  vaccination_removed: 'Removed a vaccine',
  vaccination_verified: 'Vaccine confirmed by a clinic',
  growth_added: 'Added a measurement',
  growth_removed: 'Removed a measurement',
  guardian_invited: 'Invited a guardian',
  guardian_joined: 'Joined as a guardian',
  guardian_updated: 'Changed a guardian',
  guardian_removed: 'Removed a guardian',
  guardian_left: 'Left the profile',
  guardian_identity_verified: 'Guardian identity checked',
  restriction_set: 'Restricted a guardian',
  restriction_cleared: 'Lifted a restriction',
  transfer_requested: 'Started a transfer',
  transfer_cancelled: 'Cancelled the transfer',
  transfer_completed: 'Transferred primary responsibility',
  reminder_prefs_updated: 'Changed reminder settings',
  custody_locked: 'Guardian changes locked by staff',
  custody_unlocked: 'Lock lifted by staff',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

export function ChildAccessPanel({
  memberId,
  childName,
  toast,
  onFamilyChanged,
}: {
  memberId: string;
  childName: string;
  toast: (message: string) => void;
  onFamilyChanged: () => void;
}) {
  const theme = useTheme();
  const [data, setData] = useState<GuardiansResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [invite, setInvite] = useState<null | { displayName: string; relationship: string; email: string; phone: string }>(null);
  const [issued, setIssued] = useState<null | { code: string; deliveredBy: string[]; name: string }>(null);
  const [restrict, setRestrict] = useState<null | { id: string; level: 'blocked' | 'view_only'; reason: string; orderReference: string }>(null);
  const [transferCode, setTransferCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await childHealthService.listGuardians(memberId);
      setData(g);
      if (g.you.role === 'primary' || g.you.permissions.manageGuardians) {
        setAudit(await childHealthService.fetchAudit(memberId).catch(() => []));
      } else {
        setAudit([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load guardians.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      const message = err?.message || fallback;
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  };

  const isPrimary = data?.you.role === 'primary';
  const canManage = Boolean(data?.you.permissions.manageGuardians);
  const locked = Boolean(data?.you.locked);

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const btn = (text: string, onPress: () => void, kind: 'primary' | 'alt' | 'danger' = 'alt', disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={[kind === 'primary' ? styles.btn : kind === 'danger' ? styles.btnDanger : styles.btnAlt, (disabled || busy) && { opacity: 0.6 }]}
    >
      <Text style={kind === 'primary' ? styles.btnText : kind === 'danger' ? styles.btnDangerText : styles.btnAltText}>{text}</Text>
    </TouchableOpacity>
  );
  const input = (value: string, onChange: (v: string) => void, label: string, props: { numeric?: boolean; multiline?: boolean } = {}) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor={theme.mutedLight}
        keyboardType={props.numeric ? 'phone-pad' : 'default'}
        autoCapitalize="none"
        multiline={props.multiline}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }, props.multiline && { minHeight: 64, textAlignVertical: 'top' }]}
      />
    </View>
  );

  const replace = (g: Guardian) => setData((d) => (d ? { ...d, guardians: d.guardians.map((x) => (x.id === g.id ? g : x)) } : d));

  const sendInvite = () =>
    run(async () => {
      if (!invite) return;
      const res = await childHealthService.inviteGuardian(memberId, {
        displayName: invite.displayName,
        relationship: invite.relationship,
        email: invite.email || undefined,
        phone: invite.phone || undefined,
        permissions: { viewRecords: true, receiveReminders: true },
      });
      setIssued({ code: res.inviteCode, deliveredBy: res.deliveredBy, name: invite.displayName });
      setInvite(null);
      await load();
    }, 'Could not create the invitation.');

  const togglePerm = (g: Guardian, key: keyof Guardian['permissions'], value: boolean) =>
    run(async () => {
      replace(await childHealthService.updateGuardian(memberId, g.id, { permissions: { [key]: value } }));
    }, 'Could not change this permission.');

  const confirmRemove = (g: Guardian, leaving = false) =>
    Alert.alert(leaving ? 'Leave this profile?' : `Remove ${g.displayName}?`, leaving ? 'You will lose access to this child.' : 'They lose access straight away.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: leaving ? 'Leave' : 'Remove',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await childHealthService.removeGuardian(memberId, g.id);
            if (leaving) onFamilyChanged();
            else await load();
          }, 'Could not remove this guardian.'),
      },
    ]);

  const confirmTransfer = (g: Guardian) =>
    Alert.alert(
      `Make ${g.displayName} the primary guardian?`,
      `A code goes to their own email. They must enter it to accept. You stay on as a guardian without the power to manage others.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send code',
          onPress: () =>
            run(async () => {
              await childHealthService.requestTransfer(memberId, g.id);
              toast('Code sent to their email');
              await load();
            }, 'Could not start the transfer.'),
        },
      ],
    );

  const guardianCard = (g: Guardian) => {
    const open = openId === g.id;
    const mine = !isPrimary && g.status === 'active' && !canManage;
    const status = g.restriction ? (g.restriction.level === 'blocked' ? 'Blocked' : 'View only') : g.status === 'pending' ? 'Invited' : 'Active';
    const color = g.restriction ? '#b91c1c' : g.status === 'pending' ? '#b45309' : '#15803d';
    return (
      <View key={g.id} style={card}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setOpenId(open ? null : g.id)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{g.displayName}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>
              {RELATIONSHIP_LABEL[g.relationship] || g.relationship}{g.identityVerified ? ' · identity checked' : ''}
            </Text>
          </View>
          <View style={[styles.chip, { borderColor: color }]}>
            <Text style={[styles.chipText, { color }]}>{status}</Text>
          </View>
        </TouchableOpacity>
        {open && (
          <View style={{ marginTop: 8, gap: 2 }}>
            {g.status === 'pending' && (
              <Text style={[styles.sub, { color: theme.muted }]}>
                Waiting for them to enter their code{g.inviteExpiresAt ? ` before ${when(g.inviteExpiresAt)}` : ''}.
              </Text>
            )}
            {g.restriction && (
              <Text style={[styles.sub, { color: '#b91c1c' }]}>
                {g.restriction.reason}{g.restriction.orderReference ? ` (ref ${g.restriction.orderReference})` : ''}
              </Text>
            )}
            {PERMISSION_LABELS.map((p) => (
              <View key={p.key} style={styles.permRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.permTitle, { color: theme.text }]}>{p.label}</Text>
                  <Text style={[styles.fine, { color: theme.muted }]}>{p.hint}</Text>
                </View>
                <Switch
                  value={g.permissions[p.key]}
                  disabled={busy || !canManage || locked || (p.key === 'manageGuardians' && !isPrimary)}
                  onValueChange={(v) => togglePerm(g, p.key, v)}
                  accessibilityLabel={`${p.label} for ${g.displayName}`}
                />
              </View>
            ))}
            {g.restriction && <Text style={[styles.fine, { color: theme.muted }]}>A restriction overrides these switches until it is lifted.</Text>}
            <View style={{ gap: 8, marginTop: 8 }}>
              {mine && btn('Leave this profile', () => confirmRemove(g, true), 'danger')}
              {isPrimary && g.status === 'active' && !g.restriction && !locked && btn('Make primary guardian', () => confirmTransfer(g))}
              {isPrimary && g.status === 'active' &&
                (g.restriction
                  ? btn('Lift restriction', () => run(async () => replace(await childHealthService.setRestriction(memberId, g.id, { level: 'none' })), 'Could not lift the restriction.'))
                  : btn('Restrict access', () => setRestrict({ id: g.id, level: 'view_only', reason: '', orderReference: '' })))}
              {canManage && !locked && !mine && btn(g.status === 'pending' ? 'Cancel invitation' : 'Remove', () => confirmRemove(g), 'danger')}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!data) return <View>{!!error && <Text style={styles.error}>{error}</Text>}{btn('Try again', load)}</View>;

  return (
    <View style={{ gap: 12 }}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={card}>
        <Text style={[styles.label, { color: theme.muted }]}>PRIMARY GUARDIAN</Text>
        <Text style={[styles.name, { color: theme.text }]}>{data.primary.name}{isPrimary ? ' (you)' : ''}</Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          {isPrimary ? 'You can do everything on this profile.' : 'You are a guardian. The primary guardian decides what you can do.'}
        </Text>
      </View>

      {data.custodyLock && (
        <View style={[styles.banner, { borderColor: '#b91c1c' }]}>
          <Text style={[styles.bannerText, { color: '#7f1d1d' }]}>
            WelliRecord staff locked guardian changes on this profile{data.custodyLock.orderReference ? ` (ref ${data.custodyLock.orderReference})` : ''}. Contact support to change this.
          </Text>
        </View>
      )}

      {data.pendingTransfer && isPrimary && (
        <View style={card}>
          <Text style={[styles.name, { color: theme.text }]}>Transfer waiting</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>
            The guardian must enter the code from their email before {when(data.pendingTransfer.expiresAt)}.
          </Text>
          {btn('Cancel transfer', () => run(async () => { await childHealthService.cancelTransfer(memberId); await load(); }, 'Could not cancel.'))}
        </View>
      )}

      {isPrimary && (() => {
        const t = data.transition;
        const age = t.ageYears;
        const hasSelf = data.guardians.some((g) => g.relationship === 'Self' && g.status === 'active');
        let body: string;
        if (age === null) body = `Add ${childName}'s date of birth in Details to see the options for moving to their own account.`;
        else if (age < t.teenAccessAge) body = `${childName} is ${age}. Their own account can be linked from age ${t.teenAccessAge}. Nothing to do yet.`;
        else if (age < t.majorityAge) body = `${childName} is ${age}. You can invite ${childName} to see their own record with view access. You stay the primary guardian until they turn ${t.majorityAge}.`;
        else body = hasSelf
          ? `${childName} is ${age} and has their own account linked. Open their entry below and choose "Make primary guardian" to hand over. You stay on as a guardian and ${childName} decides what you can see.`
          : `${childName} is ${age}. Invite ${childName} with their own account, then hand over primary responsibility. You stay on as a guardian and ${childName} decides what you can see.`;
        return (
          <View style={card}>
            <Text style={[styles.groupTitle, { color: theme.text }]}>Moving to their own account</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>{body}</Text>
            {age !== null && age >= t.teenAccessAge && !hasSelf && !locked &&
              btn(`Invite ${childName}`, () => setInvite({ displayName: childName, relationship: 'Self', email: '', phone: '' }))}
          </View>
        );
      })()}

      <Text style={[styles.groupTitle, { color: theme.text }]}>Guardians</Text>
      {data.guardians.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>No other guardians yet.</Text>}
      {data.guardians.map(guardianCard)}

      {issued && (
        <View style={card}>
          <Text style={[styles.name, { color: theme.text }]}>Invite code for {issued.name}</Text>
          <Text selectable style={styles.code}>{issued.code}</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>
            {issued.deliveredBy.length ? `Sent by ${issued.deliveredBy.join(' and ')}. ` : 'It was not sent automatically. '}
            They enter it under Family access, "I have an invite code". It works once and expires in 7 days.
          </Text>
          {btn('Share the code', () => Share.share({ message: `Your WelliRecord invite code is ${issued.code}. Open Family access and choose "I have an invite code".` }).catch(() => {}))}
          {btn('Done', () => setIssued(null))}
        </View>
      )}

      {canManage && !locked && !issued && (invite ? (
        <View style={card}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>Invite a guardian</Text>
          {input(invite.displayName, (v) => setInvite((i) => i && { ...i, displayName: v }), 'Their name')}
          <Text style={[styles.label, { color: theme.muted }]}>RELATIONSHIP</Text>
          <View style={styles.chipRow}>
            {GUARDIAN_RELATIONSHIPS.filter((r) => r !== 'Self' || (data.transition.ageYears ?? -1) >= data.transition.teenAccessAge).map((r) => {
              const on = invite.relationship === r;
              return (
                <TouchableOpacity key={r} accessibilityRole="button" onPress={() => setInvite((i) => i && { ...i, relationship: r })}
                  style={[styles.pick, { borderColor: on ? '#082F67' : theme.border, backgroundColor: on ? '#082F67' : theme.surface }]}>
                  <Text style={{ color: on ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{RELATIONSHIP_LABEL[r] || r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 10 }} />
          {input(invite.email, (v) => setInvite((i) => i && { ...i, email: v }), 'Email (optional)')}
          {input(invite.phone, (v) => setInvite((i) => i && { ...i, phone: v }), 'Phone (optional)', { numeric: true })}
          <Text style={[styles.fine, { color: theme.muted }]}>They start with view and reminder access. Change it after they join.</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {btn('Create invitation', sendInvite, 'primary', !invite.displayName.trim() || !invite.relationship)}
            {btn('Cancel', () => setInvite(null))}
          </View>
        </View>
      ) : (
        btn('Invite a guardian', () => setInvite({ displayName: '', relationship: '', email: '', phone: '' }), 'primary')
      ))}

      {restrict && (
        <View style={card}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>Restrict access</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>
            Use this where a court order or safeguarding concern requires it. The reason shows in the access log. WelliRecord cannot check a court order, so staff may review it.
          </Text>
          <View style={styles.chipRow}>
            {([['view_only', 'View only'], ['blocked', 'Block completely']] as const).map(([lvl, label]) => {
              const on = restrict.level === lvl;
              return (
                <TouchableOpacity key={lvl} accessibilityRole="button" onPress={() => setRestrict((r) => r && { ...r, level: lvl })}
                  style={[styles.pick, { borderColor: on ? '#b91c1c' : theme.border, backgroundColor: on ? '#b91c1c' : theme.surface }]}>
                  <Text style={{ color: on ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 10 }} />
          {input(restrict.reason, (v) => setRestrict((r) => r && { ...r, reason: v }), 'Reason *', { multiline: true })}
          {input(restrict.orderReference, (v) => setRestrict((r) => r && { ...r, orderReference: v }), 'Court order or case reference (optional)')}
          <View style={{ gap: 8 }}>
            {btn('Apply restriction', () => run(async () => {
              replace(await childHealthService.setRestriction(memberId, restrict.id, restrict));
              setRestrict(null);
            }, 'Could not apply the restriction.'), 'danger', !restrict.reason.trim())}
            {btn('Cancel', () => setRestrict(null))}
          </View>
        </View>
      )}

      {!isPrimary && (
        <View style={card}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>Transfer code</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>If the primary guardian is handing this profile to you, enter the code sent to your email.</Text>
          {input(transferCode, setTransferCode, 'Code')}
          {btn('Accept transfer', () => run(async () => {
            await childHealthService.acceptTransfer(memberId, transferCode);
            setTransferCode('');
            toast('You are now the primary guardian');
            onFamilyChanged();
            await load();
          }, 'That code did not work.'), 'primary', transferCode.trim().length < 4)}
        </View>
      )}

      {(isPrimary || canManage) && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupTitle, { color: theme.text }]}>Access log</Text>
          {audit.length === 0 && <Text style={[styles.sub, { color: theme.muted }]}>Nothing recorded yet.</Text>}
          {audit.map((e) => (
            <View key={e.id} style={[styles.logRow, { borderColor: theme.border }]}>
              <Text style={[styles.permTitle, { color: theme.text }]}>{ACTION_LABEL[e.action] || e.action.replace(/_/g, ' ')}</Text>
              <Text style={[styles.fine, { color: theme.muted }]}>
                {e.actorName}{e.actorRole === 'admin' ? ' (staff)' : ''} · {when(e.at)}
              </Text>
              {e.detail ? <Text style={[styles.fine, { color: theme.muted }]}>{e.detail}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 19 },
  fine: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 46 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: { minHeight: 44, borderRadius: 12, backgroundColor: '#E1E8F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnAltText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  btnDanger: { minHeight: 44, borderRadius: 12, backgroundColor: '#b91c1c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnDangerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700' },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  permTitle: { fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#fef2f2' },
  bannerText: { fontSize: 12, lineHeight: 17 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: '#082F67', marginVertical: 6 },
  logRow: { borderBottomWidth: 1, paddingBottom: 8 },
});
