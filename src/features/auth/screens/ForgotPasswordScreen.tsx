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
import Svg, { Circle, Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  onBack?: () => void;
  onSendResetInstructions: (email: string) => Promise<void> | void;
};

export function ForgotPasswordScreen({
  onBack,
  onSendResetInstructions,
}: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);

      await onSendResetInstructions(normalizedEmail);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to start account recovery. Please try again.',
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
            Account recovery · 1 of 4
          </Text>
        </View>

        <Text style={styles.title}>Forgot password?</Text>

        <Text style={styles.subtitle}>
          Use the email address you registered with to recover your account.
        </Text>

        <View style={styles.keyCard}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Circle
              cx={15}
              cy={9}
              r={4}
              stroke="#173F73"
              strokeWidth={1.5}
            />

            <Path
              d="M12 12L5 19M7 17L5 15M9 15L7 13"
              stroke="#173F73"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <Text style={styles.fieldLabel}>
          Registered email
        </Text>

        <TextInput
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor="#536174"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          style={styles.emailInput}
        />

        <Text style={styles.helperText}>
          Use the email address connected to your account.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.privacyCard}>
          <View style={styles.infoIcon}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Circle
                cx={12}
                cy={12}
                r={9}
                stroke="#173F73"
                strokeWidth={1.5}
              />

              <Path
                d="M12 10V16"
                stroke="#173F73"
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              <Circle cx={12} cy={7.5} r={0.9} fill="#173F73" />
            </Svg>
          </View>

          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>
              Your account stays private
            </Text>

            <Text style={styles.privacyText}>
              If an account exists for this email, you'll receive reset
              instructions. We won't reveal whether an email is registered.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleSubmit}
            disabled={submitting}
            style={[
              styles.primaryButton,
              submitting && styles.disabledButton,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Send reset instructions
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onBack}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              Back to email sign-in
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.previewText}>
          Design preview · no action is connected.
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
    marginBottom: 5,
  },

  subtitle: {
    color: '#5A697B',
    fontSize: 10,
    lineHeight: 14,
    maxWidth: 250,
    marginBottom: 17,
  },

  keyCard: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: '#E9EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  fieldLabel: {
    color: '#173D70',
    fontSize: 8.5,
    marginBottom: 5,
  },

  emailInput: {
    height: 39,
    borderWidth: 1,
    borderColor: '#B7C9E2',
    borderRadius: 7,
    paddingHorizontal: 10,
    color: '#172033',
    fontSize: 10,
    marginBottom: 5,
  },

  helperText: {
    color: '#6D7887',
    fontSize: 7,
    marginBottom: 15,
  },

  privacyCard: {
    minHeight: 65,
    borderRadius: 10,
    backgroundColor: '#E9EEF8',
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 11,
    marginBottom: 20,
  },

  infoIcon: {
    width: 24,
  },

  privacyContent: {
    flex: 1,
  },

  privacyTitle: {
    color: '#173B68',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },

  privacyText: {
    color: '#5C6B7E',
    fontSize: 7.5,
    lineHeight: 10.5,
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
  },

  primaryButton: {
    height: 39,
    borderRadius: 7,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '500',
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

  disabledButton: {
    opacity: 0.7,
  },

  previewText: {
    color: '#7A8491',
    fontSize: 6.7,
    marginTop: 10,
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