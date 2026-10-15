import React, { useState } from 'react';
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
  onBack?: () => void;

  onSendCode: (
    phoneNumber: string,
  ) => Promise<void> | void;

  onVerifyExistingCode?: () => void;
};

export function PhoneNumberScreen({
  onBack,
  onSendCode,
  onVerifyExistingCode,
}: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = async () => {
    const normalized = phone.replace(/\s+/g, '').trim();

    if (!normalized) {
      setError('Enter your phone number.');
      return;
    }

    if (normalized.length < 10) {
      setError('Enter a valid phone number.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);

      await onSendCode(normalized);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to send the verification code. Please try again.',
      );
    } finally {
      setSubmitting(false);
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
        <View style={styles.topSection}>
          <View style={styles.statusSpacer} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            style={styles.backButton}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
            >
              <Path
                d="M15 18L9 12L15 6"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <View style={styles.brandBlock}>
            <View style={styles.logoCard}>
              <LogoMark
                size={56}
                shieldColor="#0B3268"
                markColor="#FFFFFF"
                strokeColor="#0B3268"
              />
            </View>

            <Text style={styles.brandName}>
              WelliRecord
              <Text style={styles.tradeMark}>™</Text>
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>
            Phone sign-in
          </Text>

          <Text style={styles.subtitle}>
            We'll send a one-time verification code to your registered phone
            number to confirm your identity.
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Phone Number
            </Text>

            <View style={styles.phoneInputWrapper}>
              <Text style={styles.countryCode}>
                +234
              </Text>

              <View style={styles.phoneDivider} />

              <TextInput
                value={phone}
                onChangeText={(value) => {
                  setPhone(
                    value
                      .replace(/[^\d\s]/g, '')
                      .slice(0, 14),
                  );
                  setError(null);
                }}
                placeholder="Enter your phone number"
                placeholderTextColor="#161B24"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                style={styles.phoneInput}
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleSendCode}
            disabled={submitting}
            style={[
              styles.primaryButton,
              submitting && styles.disabledButton,
            ]}
          >
            {submitting ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.primaryButtonText}>
                Send Verification Code
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onVerifyExistingCode}
            style={styles.verifyExistingButton}
          >
            <Text style={styles.verifyExistingText}>
              Already have a code?{' '}
              <Text style={styles.verifyExistingLink}>
                Verify Code
              </Text>
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
              Never share your verification code with anyone.
            </Text>
          </View>

          <Text style={styles.note}>
            Phone sign-in uses your registered mobile number and requires a
            valid authentication plan.
          </Text>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#082F67',
  },

  content: {
    flexGrow: 1,
  },

  topSection: {
    minHeight: 215,
    backgroundColor: '#082F67',
    paddingHorizontal: 17,
    paddingTop: 12,
  },

  statusSpacer: {
    height: 20,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  brandBlock: {
    alignItems: 'center',
    marginTop: 13,
  },

  logoCard: {
    width: 63,
    height: 63,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  brandName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  tradeMark: {
    fontSize: 8,
  },

  body: {
    flex: 1,
    backgroundColor: '#EEF2FA',
    paddingHorizontal: 17,
    paddingTop: 22,
    paddingBottom: 16,
  },

  title: {
    color: '#0B2F62',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },

  subtitle: {
    color: '#264469',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 20,
    maxWidth: 280,
  },

  errorBox: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F0C2C2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 13,
  },

  errorText: {
    color: '#A52D2D',
    fontSize: 9,
  },

  field: {
    marginBottom: 12,
  },

  fieldLabel: {
    color: '#173D70',
    fontSize: 9,
    marginBottom: 6,
  },

  phoneInputWrapper: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: '#AFC4E4',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
  },

  countryCode: {
    color: '#111827',
    fontSize: 11.5,
    fontWeight: '600',
  },

  phoneDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#D7DFEA',
    marginHorizontal: 8,
  },

  phoneInput: {
    flex: 1,
    minHeight: 43,
    paddingVertical: 7,
    color: '#101620',
    fontSize: 11,
  },

  primaryButton: {
    minHeight: 43,
    borderRadius: 9,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  disabledButton: {
    opacity: 0.7,
  },

  verifyExistingButton: {
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 13,
  },

  verifyExistingText: {
    color: '#6C7B90',
    fontSize: 9.5,
  },

  verifyExistingLink: {
    color: '#173E73',
    fontWeight: '600',
  },

  securityCard: {
    minHeight: 42,
    backgroundColor: '#DCE5F5',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    marginBottom: 18,
  },

  lockIcon: {
    width: 24,
  },

  securityText: {
    flex: 1,
    color: '#26466D',
    fontSize: 8,
  },

  note: {
    color: '#36516F',
    fontSize: 8.2,
    lineHeight: 11.5,
    marginBottom: 21,
    maxWidth: 275,
  },

  footerBrand: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 9,
  },

  footerBrandText: {
    color: '#153B70',
    fontSize: 10,
    fontWeight: '700',
  },

  footerTradeMark: {
    fontSize: 5,
  },

  footerText: {
    color: '#395371',
    fontSize: 7.5,
    lineHeight: 10.5,
    textAlign: 'center',
    maxWidth: 190,
    alignSelf: 'center',
  },

  bottomIndicator: {
    width: 105,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0B376B',
    alignSelf: 'center',
    marginTop: 20,
  },
});