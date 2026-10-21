import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { webLinkService, type WebVisit } from '../services/webLinkService';
import { webVisitState } from '../utils/webLink';
import type { WelliApp } from '../state/useWelliApp';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

/** Video visits booked on the website, shown when the account is linked. Renders nothing otherwise. */
export function WebVisitsSection({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const theme = useTheme();
  const [visits, setVisits] = useState<WebVisit[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    webLinkService.visits().then((v) => alive && setVisits(v)).catch(() => alive && setVisits([]));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!visits.length) return null;

  return (
    <View>
      <Text style={[styles.heading, { color: theme.muted }]}>BOOKED ON THE WEBSITE</Text>
      {visits.map((v) => {
        const st = webVisitState(v, now);
        return (
          <View key={v.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>{v.organizationName || 'Video visit'}</Text>
            <Text style={[styles.sub, { color: theme.muted }]}>{fmt(v.scheduledFor)} · Video visit</Text>
            {!!v.reasonForVisit && <Text style={[styles.sub, { color: theme.muted }]}>Reason: {v.reasonForVisit}</Text>}
            {st === 'open' ? (
              <TouchableOpacity
                onPress={() => actions.joinWebVisit({ id: v.id, facilityName: v.organizationName })}
                disabled={state.joiningVisitId === v.id}
                accessibilityRole="button"
                style={styles.join}
              >
                <Text style={styles.joinText}>{state.joiningVisitId === v.id ? 'Connecting…' : 'Join video visit'}</Text>
              </TouchableOpacity>
            ) : st === 'early' ? (
              <Text style={[styles.sub, { color: theme.muted }]}>You can join from {fmt(v.joinOpensAt)}.</Text>
            ) : st === 'closed' ? (
              <Text style={[styles.sub, { color: theme.muted }]}>The time to join has passed.</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 19 },
  join: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
