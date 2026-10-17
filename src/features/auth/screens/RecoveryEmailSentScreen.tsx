import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  email: string;
  onBack?: () => void;
  onResend: () => Promise<void> | void;
  onChangeEmail?: () => void;
  onBackToSignIn?: () => void;
  onContinue?: () => void;
};

export function RecoveryEmailSentScreen({
  email,
  onBack,
  onResend,
  onChangeEmail,
  onBackToSignIn,
  onContinue,
}: Props) {
  const [seconds, setSeconds] = useState(30);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const handleResend = async () => {
    if (seconds > 0 || resending) return;

    try {
      setError(null);
      setResending(true);

      await onResend();

      setSeconds(30);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to resend reset instructions.',
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={styles.backButton}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18L9 12L15 6"
              stroke="#172033"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.headerBrand}>
          WelliRecord<Text style={styles.tradeMark}>™</Text>
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.stepRow}>
        <LogoMark
          size={21}
          shieldColor="#0B3268"
          markColor="#FFFFFF"
          strokeColor="#0B3268"
        />

        <Text style={styles.stepText}>
          Account recovery · 2 of 4
        </Text>
      </View>

      <Text style={styles.title}>Check your email</Text>

      <Text style={styles.subtitle}>
        If an account exists for this email, we sent a 6-digit reset code. It expires in 5 minutes.
      </Text>

      <View style={styles.mailCard}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6.5H20V17.5H4V6.5Z"
            stroke="#173F73"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          <Path
            d="M5 8L12 13L19 8"
            stroke="#173F73"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      <View style={styles.emailCard}>
        <Text style={styles.emailCardLabel}>
          Email used
        </Text>

        <Text style={styles.emailValue}>
          {maskEmail(email)}
        </Text>

      </View>

      <Text style={styles.instructions}>
        Check your inbox and junk folder. The code can take a minute to arrive.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={onContinue}
          style={[styles.secondaryButton, { backgroundColor: '#0B3268' }]}
        >
          <Text style={[styles.secondaryButtonText, { color: '#FFFFFF' }]}>
            Enter reset code
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={seconds > 0 || resending}
          onPress={handleResend}
          style={[
            styles.secondaryButton,
            seconds > 0 && styles.disabledResend,
          ]}
        >
          {resending ? (
            <ActivityIndicator size="small" color="#173B68" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {seconds > 0
                ? `Resend in 00:${String(seconds).padStart(2, '0')}`
                : 'Resend reset code'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onChangeEmail}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            Change email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackToSignIn}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            Back to email sign-in
          </Text>
        </TouchableOpacity>
      </View>


      <View style={styles.bottomIndicator} />
    </ScrollView>
  );
}

function maskEmail(email: string) {
  const normalized = email.trim();

  const [local, domain] = normalized.split('@');

  if (!local || !domain) {
    return normalized;
  }

  if (local.length <= 2) {
    return `${local[0] ?? ''}•••@${domain}`;
  }

  return `${local.slice(0, 1)}•••${local.slice(-4)}@${domain}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },

  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBrand: {
    color: '#101827',
    fontSize: 10,
    fontWeight: '600',
  },

  tradeMark: {
    fontSize: 5,
  },

  headerSpacer: {
    width: 32,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },

  stepText: {
    color: '#23466E',
    fontSize: 8,
    fontWeight: '700',
  },

  title: {
    color: '#082F67',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    marginBottom: 4,
  },

  subtitle: {
    color: '#5A697B',
    fontSize: 10,
    lineHeight: 14,
    maxWidth: 255,
    marginBottom: 18,
  },

  mailCard: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: '#E9EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emailCard: {
    backgroundColor: '#E9EEF8',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 17,
  },

  emailCardLabel: {
    color: '#173B68',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },

  emailValue: {
    color: '#173B68',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 5,
  },

  maskedText: {
    color: '#788596',
    fontSize: 7,
  },

  instructions: {
    color: '#5A697B',
    fontSize: 8.5,
    lineHeight: 12,
    marginBottom: 20,
  },

  errorBox: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F0C2C2',
    borderRadius: 7,
    padding: 8,
    marginBottom: 10,
  },

  errorText: {
    color: '#A52D2D',
    fontSize: 8,
  },

  actions: {
    marginTop: 'auto',
    gap: 7,
  },

  secondaryButton: {
    height: 38,
    borderRadius: 7,
    backgroundColor: '#E7EDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: '#173B68',
    fontSize: 9,
  },

  disabledResend: {
    opacity: 0.78,
  },

  previewText: {
    color: '#7A8491',
    fontSize: 6.7,
    marginTop: 9,
  },

  bottomIndicator: {
    width: 82,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0B376B',
    alignSelf: 'center',
    marginTop: 19,
  },
});