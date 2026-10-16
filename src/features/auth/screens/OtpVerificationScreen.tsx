import { useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  phoneNumber: string;
  purpose?: 'signup' | 'login';

  onBack?: () => void;

  onVerify: (code: string) => Promise<void> | void;

  onResend: () => Promise<void> | void;

  onChangePhoneNumber?: () => void;
};

export function OtpVerificationScreen({
  phoneNumber,
  purpose = 'login',
  onBack,
  onVerify,
  onResend,
  onChangePhoneNumber,
}: Props) {
  const [digits, setDigits] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const [error, setError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [resendSeconds, setResendSeconds] = useState(30);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const code = digits.join('');

  const handleDigitChange = (
    value: string,
    index: number,
  ) => {
    const numeric = value.replace(/\D/g, '');

    if (!numeric) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      setError(null);
      return;
    }

    // Allows Android/iOS OTP autofill or pasted six-digit codes.
    if (numeric.length > 1) {
      const pastedDigits = numeric
        .slice(0, 6)
        .split('');

      const next = [...digits];

      pastedDigits.forEach((digit, offset) => {
        if (index + offset < 6) {
          next[index + offset] = digit;
        }
      });

      setDigits(next);
      setError(null);

      const nextIndex = Math.min(
        index + pastedDigits.length,
        5,
      );

      inputRefs.current[nextIndex]?.focus();

      return;
    }

    const next = [...digits];
    next[index] = numeric.slice(-1);

    setDigits(next);
    setError(null);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    key: string,
    index: number,
  ) => {
    if (
      key === 'Backspace' &&
      digits[index] === '' &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }

    try {
      setError(null);
      setVerifying(true);

      await onVerify(code);
    } catch (err: any) {
      setError(
        err?.message ||
          'The verification code is invalid or has expired.',
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

      setDigits(['', '', '', '', '', '']);
      setResendSeconds(30);

      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to resend the verification code.',
      );
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = maskPhoneNumber(phoneNumber);

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
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
            >
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
            WelliRecord
            <Text style={styles.tradeMark}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.flowLabelRow}>
          <LogoMark
            size={22}
            shieldColor="#0A3268"
            markColor="#FFFFFF"
            strokeColor="#0A3268"
          />

          <Text style={styles.flowLabel}>
            {purpose === 'signup'
              ? 'ACCOUNT · PHONE VERIFICATION'
              : 'PHONE SIGN-IN · 6-DIGIT PHONE OTP'}
          </Text>
        </View>

        <Text style={styles.title}>
          Verify Your Identity
        </Text>

        <Text style={styles.subtitle}>
          {purpose === 'signup'
            ? 'Enter the 6-digit code sent to this phone number to finish securing your account.'
            : 'Enter the 6-digit verification code sent to your phone number.'}
        </Text>

        {!!maskedPhone && (
          <Text style={styles.phoneDestination}>
            Sent to {maskedPhone}
          </Text>
        )}

        <Text style={styles.requirementNote}>
          Verification codes expire shortly and can only be used once.
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.logoCard}>
            <LogoMark
              size={52}
              shieldColor="#0B3268"
              markColor="#FFFFFF"
              strokeColor="#0B3268"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>
          Verification Code
        </Text>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(value) =>
                handleDigitChange(value, index)
              }
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(
                  nativeEvent.key,
                  index,
                )
              }
              keyboardType="number-pad"
              maxLength={index === 0 ? 6 : 1}
              selectTextOnFocus
              textContentType={
                index === 0
                  ? 'oneTimeCode'
                  : 'none'
              }
              autoComplete={
                index === 0
                  ? 'one-time-code'
                  : 'off'
              }
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
              ]}
            />
          ))}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={handleVerify}
          disabled={verifying}
          style={[
            styles.primaryButton,
            verifying && styles.disabledButton,
          ]}
        >
          {verifying ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.primaryButtonText}>
              {purpose === 'signup' ? 'Verify phone' : 'Verify & Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>
            Didn't receive a code?{' '}
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={
              resendSeconds > 0 ||
              resending
            }
            onPress={handleResend}
          >
            {resending ? (
              <ActivityIndicator
                size="small"
                color="#173F73"
              />
            ) : (
              <Text
                style={[
                  styles.resendLink,
                  resendSeconds > 0 &&
                    styles.resendLinkDisabled,
                ]}
              >
                Resend Code
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {resendSeconds > 0 && (
          <>
            <View style={styles.countdownBadge}>
              <Svg
                width={11}
                height={11}
                viewBox="0 0 24 24"
                fill="none"
              >
                <Circle
                  cx={12}
                  cy={12}
                  r={9}
                  stroke="#173F73"
                  strokeWidth={1.5}
                />

                <Path
                  d="M12 7V12L15 14"
                  stroke="#173F73"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </Svg>

              <Text style={styles.countdownText}>
                00:
                {String(resendSeconds).padStart(
                  2,
                  '0',
                )}
              </Text>
            </View>

            <Text style={styles.countdownHint}>
              You can request another code after the countdown ends.
            </Text>
          </>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onChangePhoneNumber}
          style={styles.changePhoneButton}
        >
          <Text style={styles.changePhoneText}>
            Change Phone Number
          </Text>
        </TouchableOpacity>

        <View style={styles.securityCard}>
          <View style={styles.lockIcon}>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
            >
              <Path
                d="M7 10V8C7 5.24 9.24 3 12 3C14.76 3 17 5.24 17 8V10"
                stroke="#315B90"
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              <Path
                d="M6 10H18V20H6V10Z"
                stroke="#315B90"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={styles.securityText}>
            Your verification code is private. WelliRecord support will
            never ask you to disclose it.
          </Text>
        </View>

        <View style={styles.footerBrand}>
          <LogoMark
            size={18}
            shieldColor="#0B3268"
            markColor="#FFFFFF"
            strokeColor="#0B3268"
          />

          <Text style={styles.footerBrandText}>
            WelliRecord
            <Text style={styles.footerTradeMark}>
              ™
            </Text>
          </Text>
        </View>

        <Text style={styles.footerText}>
          One patient. One trusted record.
          Accessible when it matters.
        </Text>

        <View style={styles.bottomIndicator} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function maskPhoneNumber(phone: string) {
  const clean = phone.replace(/\s+/g, '');

  if (clean.length < 7) {
    return clean;
  }

  const start = clean.slice(0, 4);
  const end = clean.slice(-3);

  return `${start}••••${end}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 18,
  },

  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  headerBrand: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '600',
  },

  tradeMark: {
    fontSize: 22,
  },

  headerSpacer: {
    width: 32,
  },

  flowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },

  flowLabel: {
    color: '#24456E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.15,
  },

  title: {
    color: '#082F67',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.45,
    marginBottom: 6,
  },

  subtitle: {
    color: '#475F7C',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },

  phoneDestination: {
    color: '#173F73',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },

  requirementNote: {
    color: '#718096',
    fontSize: 8.5,
    lineHeight: 12,
    marginTop: 7,
    marginBottom: 16,
  },

  heroCard: {
    height: 84,
    backgroundColor: '#DCE5F5',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logoCard: {
    width: 59,
    height: 59,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldLabel: {
    color: '#173D70',
    fontSize: 9.5,
    marginBottom: 6,
  },

  otpRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 16,
  },

  otpInput: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D8E0EC',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0B2F62',
  },

  otpInputFilled: {
    borderColor: '#8FA8C6',
    backgroundColor: '#FAFBFD',
  },

  errorBox: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F0C2C2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 11,
  },

  errorText: {
    color: '#A52D2D',
    fontSize: 8.5,
  },

  primaryButton: {
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
  },

  disabledButton: {
    opacity: 0.7,
  },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 22,
  },

  resendPrompt: {
    color: '#6A788B',
    fontSize: 8.8,
  },

  resendLink: {
    color: '#173F73',
    fontSize: 8.8,
    fontWeight: '600',
  },

  resendLinkDisabled: {
    color: '#9BA8B8',
  },

  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    backgroundColor: '#E9EEF7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },

  countdownText: {
    color: '#173F73',
    fontSize: 8,
    fontWeight: '600',
  },

  countdownHint: {
    color: '#49627D',
    fontSize: 7.6,
    textAlign: 'center',
    marginTop: 9,
  },

  changePhoneButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 7,
  },

  changePhoneText: {
    color: '#133A6B',
    fontSize: 9.5,
    fontWeight: '700',
  },

  securityCard: {
    minHeight: 50,
    backgroundColor: '#DFE7F6',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 24,
  },

  lockIcon: {
    width: 23,
    paddingTop: 1,
  },

  securityText: {
    flex: 1,
    color: '#385471',
    fontSize: 7.8,
    lineHeight: 11,
  },

  footerBrand: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },

  footerBrandText: {
    color: '#173B70',
    fontSize: 9.5,
    fontWeight: '700',
  },

  footerTradeMark: {
    fontSize: 5,
  },

  footerText: {
    color: '#425872',
    fontSize: 7.3,
    lineHeight: 10.5,
    textAlign: 'center',
    maxWidth: 195,
    alignSelf: 'center',
  },

  bottomIndicator: {
    width: 102,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#101820',
    alignSelf: 'center',
    marginTop: 21,
  },
});


