import { useState } from 'react';
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
  onSavePassword: (password: string) => Promise<void> | void;
  onBackToSignIn?: () => void;
};

export function CreateNewPasswordScreen({
  onBack,
  onSavePassword,
  onBackToSignIn,
}: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Both passwords should match.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);

      await onSavePassword(password);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to reset your password. Please try again.',
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

          <Text style={styles.brand}>
            WelliRecord<Text style={styles.tm}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.stepRow}>
          <LogoMark
            size={20}
            shieldColor="#0B3268"
            markColor="#FFFFFF"
            strokeColor="#0B3268"
          />

          <Text style={styles.stepText}>
            Account recovery · 3 of 4
          </Text>
        </View>

        <Text style={styles.title}>
          Choose a new{'\n'}password
        </Text>

        <Text style={styles.subtitle}>
          Use a password you don't use for other accounts.
        </Text>

        <Text style={styles.label}>New password</Text>

        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          placeholder="••••••••••"
          placeholderTextColor="#697587"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="new-password"
          style={[
            styles.input,
            error && styles.inputError,
          ]}
        />

        <Text style={styles.label}>
          Confirm new password
        </Text>

        <TextInput
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setError(null);
          }}
          placeholder="••••••••••"
          placeholderTextColor="#697587"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="new-password"
          style={[
            styles.input,
            error && styles.inputError,
          ]}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Text style={styles.matchText}>
            Both passwords should match.
          </Text>
        )}

        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>
            Password guidance
          </Text>

          <Text style={styles.guidanceText}>
            Choose a long, unique password. Avoid your name, email or easily
            guessed phrases.
          </Text>

          <Text style={styles.guidanceFootnote}>
            Guidance is illustrative, not the production password policy.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleSave}
            disabled={submitting}
            style={[
              styles.primaryButton,
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Save new password
              </Text>
            )}
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

        <Text style={styles.preview}>
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
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  backButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brand: {
    fontSize: 9,
    fontWeight: '600',
    color: '#101827',
  },

  tm: {
    fontSize: 5,
  },

  headerSpacer: {
    width: 31,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },

  stepText: {
    color: '#24476E',
    fontSize: 7.7,
    fontWeight: '700',
  },

  title: {
    color: '#082F67',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    marginBottom: 5,
  },

  subtitle: {
    color: '#5A697B',
    fontSize: 8.5,
    lineHeight: 12,
    marginBottom: 15,
  },

  label: {
    color: '#173D70',
    fontSize: 7.5,
    marginBottom: 4,
  },

  input: {
    height: 36,
    borderWidth: 1,
    borderColor: '#C3D0E3',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 9,
    color: '#172033',
    marginBottom: 11,
  },

  inputError: {
    borderColor: '#DC5A5A',
  },

  matchText: {
    color: '#697789',
    fontSize: 6.8,
    marginTop: -6,
    marginBottom: 13,
  },

  errorText: {
    color: '#C43D3D',
    fontSize: 7,
    marginTop: -6,
    marginBottom: 13,
  },

  guidanceCard: {
    backgroundColor: '#E9EEF8',
    borderRadius: 9,
    padding: 11,
  },

  guidanceTitle: {
    color: '#173B68',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 5,
  },

  guidanceText: {
    color: '#536579',
    fontSize: 7.4,
    lineHeight: 10.5,
    marginBottom: 7,
  },

  guidanceFootnote: {
    color: '#8791A0',
    fontSize: 6.5,
  },

  actions: {
    marginTop: 'auto',
  },

  primaryButton: {
    height: 38,
    borderRadius: 7,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
  },

  secondaryButton: {
    height: 36,
    borderRadius: 7,
    backgroundColor: '#E8EDF6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: '#173B68',
    fontSize: 8.5,
  },

  disabled: {
    opacity: 0.7,
  },

  preview: {
    color: '#7C8590',
    fontSize: 6.3,
    marginTop: 10,
  },

  bottomIndicator: {
    width: 80,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0B376B',
    alignSelf: 'center',
    marginTop: 17,
  },
});