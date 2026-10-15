import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  email: string;
  purpose?: 'signup' | 'login';
  onBack?: () => void;
  onVerify: (code: string) => Promise<void> | void;
  onResend: () => Promise<void> | void;
  onUseDifferentEmail?: () => void;
};

export function EmailVerificationScreen({
  email,
  purpose = 'signup',
  onBack,
  onVerify,
  onResend,
  onUseDifferentEmail,
}: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleVerify = async () => {
    const cleanCode = code.trim();

    if (!cleanCode) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    if (cleanCode.length < 6) {
      setError('Enter the complete verification code.');
      return;
    }

    try {
      setError(null);
      setVerifying(true);
      await onVerify(cleanCode);
    } catch (err: any) {
      setError(
        err?.message || 'The verification code is invalid or has expired.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) return;

    try {
      setError(null);
      setResending(true);
      await onResend();
      setCode('');
      setResendSeconds(30);
    } catch (err: any) {
      setError(err?.message || 'Unable to resend the verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
                stroke="#182033"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.brandName}>
            WelliRecord<Text style={styles.tradeMark}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.eyebrow}>
          {purpose === 'login' ? 'SIGN IN · SECURITY CHECK' : 'ACCOUNT · STEP 2 OF 2'}
        </Text>

        <Text style={styles.title}>Check your inbox</Text>

        <Text style={styles.subtitle}>
          {purpose === 'login'
            ? 'Enter the code sent to your email to finish signing in.'
            : 'Verify your email before continuing to your profile.'}
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.logoBadge}>
            <LogoMark
              size={45}
              shieldColor="#092F67"
              markColor="#FFFFFF"
              strokeColor="#FFFFFF"
            />
          </View>

          <View style={styles.mailIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 6.5H20V17.5H4V6.5Z"
                stroke="#143B70"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <Path
                d="M5 8L12 13L19 8"
                stroke="#143B70"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>

        <View style={styles.verificationCard}>
          <Text style={styles.cardTitle}>Enter your email code</Text>

          <Text style={styles.cardDescription}>
            A 6-digit verification code was sent to this email address.
          </Text>

          {!!email && (
            <Text style={styles.emailText}>{email}</Text>
          )}

          <Text style={styles.fieldLabel}>Verification code</Text>

          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="Enter code from email"
            placeholderTextColor="#2D3441"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            style={styles.codeInput}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleVerify}
            disabled={verifying}
            style={[
              styles.verifyButton,
              verifying && styles.disabledButton,
            ]}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>
                {purpose === 'login' ? 'Verify & Continue' : 'Verify email'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleResend}
            disabled={resendSeconds > 0 || resending}
            style={styles.resendButton}
          >
            {resending ? (
              <ActivityIndicator size="small" color="#173D70" />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  resendSeconds > 0 && styles.resendDisabled,
                ]}
              >
                {resendSeconds > 0
                  ? `Resend code · available in 00:${String(
                      resendSeconds,
                    ).padStart(2, '0')}`
                  : 'Resend code'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
                stroke="#123E75"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <Path
                d="M9.5 12L11 13.5L14.5 10"
                stroke="#123E75"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>
              Keep your account private
            </Text>

            <Text style={styles.privacyText}>
              Never share your verification code or password with anyone.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onUseDifferentEmail}
          style={styles.differentEmailButton}
        >
          <Text style={styles.differentEmailText}>
            Use a different email
          </Text>
        </TouchableOpacity>

        <Text style={styles.previewNotice}>
          Verification codes expire after a short period. If you did not request
          this code, return to sign in and do not share it.
        </Text>

        <View style={styles.bottomIndicator} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: 10,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FB',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  brandName: {
    color: '#101827',
    fontSize: 26,
    fontWeight: '700',
  },

  tradeMark: {
    fontSize: 22,
  },

  headerSpacer: {
    width: 34,
  },

  eyebrow: {
    color: '#45617E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 7,
  },

  title: {
    color: '#0B2B59',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.45,
  },

  subtitle: {
    color: '#30445E',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 3,
    marginBottom: 20,
    maxWidth: 270,
  },

  heroCard: {
    height: 141,
    backgroundColor: '#D4DDED',
    borderTopWidth: 5,
    borderTopColor: '#0B3268',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  logoBadge: {
    width: 77,
    height: 77,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 7,
  },

  mailIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  verificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#14213A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },

  cardTitle: {
    color: '#102F5C',
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 8,
  },

  cardDescription: {
    color: '#1B3D68',
    fontSize: 14,
    lineHeight: 16,
    maxWidth: 250,
  },

  emailText: {
    color: '#0B2E61',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 10,
  },

  fieldLabel: {
    color: '#243E60',
    fontSize: 14,
    marginTop: 11,
    marginBottom: 6,
    fontWeight: '800',
  },

  codeInput: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: '#F2F4F9',
    paddingHorizontal: 13,
    color: '#151B25',
    fontSize: 14,
    marginBottom: 10,
  },

  errorBox: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F0C2C2',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginBottom: 10,
  },

  errorText: {
    color: '#A52D2D',
    fontSize: 12,
    lineHeight: 13,
  },

  verifyButton: {
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.72,
  },

  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  resendButton: {
    minHeight: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  resendText: {
    color: '#173D70',
    fontSize: 14,
    fontWeight: '500',
  },

  resendDisabled: {
    opacity: 0.85,
  },

  privacyCard: {
    minHeight: 64,
    borderRadius: 11,
    backgroundColor: '#EFF2F8',
    flexDirection: 'row',
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 16,
  },

  privacyIcon: {
    width: 24,
    paddingTop: 1,
  },

  privacyContent: {
    flex: 1,
  },

  privacyTitle: {
    color: '#17375F',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },

  privacyText: {
    color: '#566A83',
    fontSize: 10,
    lineHeight: 16,
    maxWidth: 245,
  },

  differentEmailButton: {
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#D5DEEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  differentEmailText: {
    color: '#173B69',
    fontSize: 14,
    fontWeight: '500',
  },

  previewNotice: {
    color: '#2E3440',
    fontSize: 10,
    lineHeight: 11,
    maxWidth: 260,
    marginBottom: 17,
  },

  bottomIndicator: {
    width: 105,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0B376B',
    alignSelf: 'center',
    marginTop: 4,
  },
});


