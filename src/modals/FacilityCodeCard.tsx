import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { childHealthService, type FacilityGrant } from '../services/childHealthService';
import { ApiError } from '../services/apiClient';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

const ACTION: Record<string, string> = {
  viewed: 'opened the record',
  vaccination_added: 'recorded a vaccine',
  vaccination_verified: 'confirmed a vaccine',
  growth_added: 'added a measurement',
};

/**
 * Lets a guardian give a clinic access to this child's record for a short time.
 * The code is shown once. The clinic uses it with its own staff sign-in.
 * Hidden for people who may not manage access.
 */
export function FacilityCodeCard({ memberId, childName, toast }: { memberId: string; childName: string; toast: (m: string) => void }) {
  const theme = useTheme();
  const [grants, setGrants] = useState<FacilityGrant[]>([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGrants(await childHealthService.listFacilityGrants(memberId));
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 423)) setHidden(true);
      else setError(err instanceof Error ? err.message : 'Could not load clinic access.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden) return null;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await childHealthService.createFacilityCode(memberId, 24);
      setIssued({ code: res.code, expiresAt: res.grant.expiresAt });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the code.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = (g: FacilityGrant) => {
    Alert.alert('Cancel this code?', 'The clinic will not be able to use it again.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel code',
        style: 'destructive',
        onPress: async () => {
          try {
            await childHealthService.revokeFacilityGrant(memberId, g.id);
            setIssued(null);
            toast('Code cancelled');
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not cancel the code.');
          }
        },
      },
    ]);
  };

  const active = grants.filter((g) => g.state === 'active');
  const past = grants.filter((g) => g.state !== 'active' && g.uses.length > 0).slice(0, 3);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.heading, { color: theme.text }]}>Clinic visit code</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>
        At a visit, give the clinic this code with {childName}'s WelliID. For 24 hours they can see the record and add confirmed vaccines and measurements. You can cancel it any time. Everything the clinic does shows in the access log and you get a notification when they add something.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : (
        <>
          {issued ? (
            <View style={[styles.codeBox, { borderColor: theme.border }]}>
              <Text selectable style={[styles.code, { color: theme.text }]}>{issued.code}</Text>
              <Text style={[styles.hint, { color: theme.muted }]}>Valid until {when(issued.expiresAt)}. This is the only time the code is shown.</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => Share.share({ message: `WelliRecord clinic visit code for ${childName}: ${issued.code}. Valid until ${when(issued.expiresAt)}.` }).catch(() => {})}
                style={styles.link}
              >
                <Text style={styles.linkText}>Share the code</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {active.map((g) => (
            <View key={g.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Active until {when(g.expiresAt)}</Text>
                {g.uses.slice(-2).map((u, i) => (
                  <Text key={i} style={[styles.hint, { color: theme.muted }]}>
                    {u.staffName}{u.organization ? `, ${u.organization}` : ''} {ACTION[u.action] || u.action} · {when(u.at)}
                  </Text>
                ))}
              </View>
              <TouchableOpacity accessibilityRole="button" onPress={() => revoke(g)} style={styles.link}>
                <Text style={[styles.linkText, { color: '#b91c1c' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))}
          {past.map((g) => (
            <Text key={g.id} style={[styles.hint, { color: theme.muted }]}>
              Earlier code{g.state === 'revoked' ? ' (cancelled)' : ''}: used by {g.uses[g.uses.length - 1].staffName}
              {g.uses[g.uses.length - 1].organization ? `, ${g.uses[g.uses.length - 1].organization}` : ''}
            </Text>
          ))}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={create} style={[styles.btn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create a code for a clinic visit</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  hint: { fontSize: 12, lineHeight: 17 },
  codeBox: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  link: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { color: '#315B90', fontSize: 13, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 12 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: '#082F67', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
