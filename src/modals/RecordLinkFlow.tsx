import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { webLinkService, type RecordLinkInfo } from '../services/webLinkService';
import { SCOPE_TEXT } from '../utils/webLink';

/**
 * The hospital record-link steps done in the app: confirm it is you with a code sent to the phone the hospital
 * holds, choose what to link, then wait for the hospital. The server rules are the website's; this is only the screen.
 * Wording matches the website page (consent text version draft-1, no legal review yet).
 */
export function RecordLinkFlow({ token, onChanged }: { token: string; onChanged?: () => void }) {
  const theme = useTheme();
  const [info, setInfo] = useState<RecordLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [scopes, setScopes] = useState<string[]>(['demographics']);
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    try {
      const i = await webLinkService.recordLinkInfo(token);
      setInfo(i);
      setScopes((prev) => (prev.length > 1 ? prev : i.scopes));
      setError(null);
    } catch (e: any) {
      setInfo(null);
      setError(e?.message || 'This link is not valid. Ask the hospital for a new one.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, fallback: string, reloadOnError = false) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e: any) {
      setError(e?.message || fallback);
      if (reloadOnError) await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator color={theme.muted} style={{ marginTop: 16 }} />;

  const errorText = !!error && <Text style={styles.error}>{error}</Text>;
  if (!info) return <View style={styles.box}>{errorText}</View>;

  const text = [styles.body, { color: theme.text }];
  const muted = [styles.small, { color: theme.muted }];
  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }];
  const org = info.organization;

  if (info.status === 'linked') {
    return <Text style={text}>{org} has linked your record. Items from the hospital are marked as imported and have not been confirmed by a clinician in WelliRecord. Review them in your records.</Text>;
  }
  if (info.status === 'expired' || info.status === 'cancelled') {
    return <Text style={text}>{info.status === 'expired' ? 'This link has expired.' : 'This link was cancelled.'} Ask {org} for a new link.</Text>;
  }
  if (info.status === 'action_required') {
    return <Text style={text}>{org} needs to check something. Nothing was shared. Contact {org} and ask them to review your link.</Text>;
  }
  if (info.status === 'under_hospital_review' || info.status === 'linking_in_progress') {
    return <Text style={text}>Waiting for {org}. Your consent is recorded. The hospital reviews and releases your record, and you will get a notification when it is done.</Text>;
  }

  if (info.status === 'awaiting_patient_verification') {
    return (
      <View style={styles.box}>
        <Text style={text}>
          {info.firstName ? `${info.firstName}, ` : ''}{org} started linking your record. To confirm it is you, we send a 6-digit code by SMS to the phone number {org} has on file for you. We also check your details against the hospital record.
        </Text>
        {!sentTo ? (
          <TouchableOpacity
            disabled={busy}
            accessibilityRole="button"
            style={[styles.btn, busy && styles.off]}
            onPress={async () => {
              await run(async () => setSentTo((await webLinkService.sendCode(token)).sentTo), 'We could not send the code.');
            }}
          >
            <Text style={styles.btnText}>{busy ? 'Sending…' : 'Send code'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={muted}>Code sent to {sentTo}. It expires in 10 minutes.</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              placeholder="6-digit code"
              placeholderTextColor={theme.muted}
              style={input}
              accessibilityLabel="6-digit code"
            />
            <TouchableOpacity
              disabled={busy || code.length !== 6}
              accessibilityRole="button"
              style={[styles.btn, (busy || code.length !== 6) && styles.off]}
              onPress={async () => {
                // A failed identity check moves the link to the hospital, so reload either way.
                const ok = await run(() => webLinkService.verifyCode(token, code), 'That code did not work.', true);
                if (ok) {
                  setCode('');
                  await load();
                  onChanged?.();
                }
              }}
            >
              <Text style={styles.btnText}>{busy ? 'Checking…' : 'Verify'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy}
              accessibilityRole="button"
              onPress={() => run(async () => setSentTo((await webLinkService.sendCode(token)).sentTo), 'We could not send the code.')}
            >
              <Text style={[styles.link, { color: theme.text }]}>Send a new code</Text>
            </TouchableOpacity>
          </>
        )}
        {errorText}
        <Text style={muted}>If you no longer have that phone number, contact {org} to update it.</Text>
      </View>
    );
  }

  if (info.status === 'awaiting_consent') {
    return (
      <View style={styles.box}>
        <Text style={text}>{org} will copy the items you choose into your WelliRecord account after it reviews and releases them. Nothing is copied before that.</Text>
        {info.scopes.map((s) => {
          const t = SCOPE_TEXT[s];
          if (!t) return null;
          return (
            <View key={s} style={[styles.scope, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scopeTitle, { color: theme.text }]}>{t.title}</Text>
                <Text style={muted}>{t.body}</Text>
              </View>
              <Switch
                value={scopes.includes(s)}
                disabled={t.fixed}
                onValueChange={() => setScopes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
                accessibilityLabel={t.title}
              />
            </View>
          );
        })}
        <Text style={muted}>Imported items keep their source ({org}) and are marked as not yet confirmed by a clinician.</Text>
        <Text style={muted}>You can withdraw before the hospital releases the record. Files and scans are not included.</Text>
        <Text style={muted}>{org} will know your account is linked to its record.</Text>
        <View style={styles.agree}>
          <Switch value={agreed} onValueChange={setAgreed} accessibilityLabel="I agree" />
          <Text style={[styles.small, { color: theme.text, flex: 1 }]}>I agree to {org} sharing the items selected above into my WelliRecord account.</Text>
        </View>
        {errorText}
        <TouchableOpacity
          disabled={busy || !agreed || scopes.length === 0}
          accessibilityRole="button"
          style={[styles.btn, (busy || !agreed || scopes.length === 0) && styles.off]}
          onPress={async () => {
            const ok = await run(() => webLinkService.consent(token, info.consentVersion, scopes), 'We could not record your consent.');
            if (ok) {
              await load();
              onChanged?.();
            }
          }}
        >
          <Text style={styles.btnText}>{busy ? 'Saving…' : 'Give consent'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <Text style={text}>This link is not ready yet. Check with {org}.</Text>;
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 12.5, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 18, letterSpacing: 4, textAlign: 'center' },
  error: { color: '#B91C1C', fontSize: 13 },
  btn: { backgroundColor: '#082F67', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  off: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { fontSize: 13, textAlign: 'center', textDecorationLine: 'underline', padding: 6 },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  scopeTitle: { fontSize: 14, fontWeight: '700' },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
