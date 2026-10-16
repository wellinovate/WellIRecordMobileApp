import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  onBack?: () => void;
  onSignInWithNewPassword: () => void;
};

export function PasswordResetSuccessScreen({
  onBack,
  onSignInWithNewPassword,
}: Props) {
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
          Account recovery · 4 of 4
        </Text>
      </View>

      <Text style={styles.title}>Ready to sign in</Text>

      <Text style={styles.subtitle}>
        Your password has been updated successfully.
      </Text>

      <View style={styles.successIcon}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke="#173F73"
            strokeWidth={1.5}
          />

          <Path
            d="M8.5 12L11 14.5L15.5 9.5"
            stroke="#173F73"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
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
          </Svg>
        </View>

        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>
            Password reset complete
          </Text>

          <Text style={styles.infoText}>
            In a connected service, you would return to email sign-in and use
            your new password.
          </Text>
        </View>
      </View>

      <Text style={styles.securityText}>
        Keep your password private. WelliRecord™ will never need it in a
        support message.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={onSignInWithNewPassword}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            Sign in with new password
          </Text>
        </TouchableOpacity>
      </View>


      <View style={styles.bottomIndicator} />
    </ScrollView>
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
    fontWeight: '800',
    marginBottom: 4,
  },

  subtitle: {
    color: '#5A697B',
    fontSize: 8.5,
    marginBottom: 15,
  },

  successIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#E9EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: '#E9EEF8',
    borderRadius: 9,
    flexDirection: 'row',
    padding: 11,
    marginBottom: 14,
  },

  infoIcon: {
    width: 24,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: '#173B68',
    fontSize: 8.5,
    fontWeight: '700',
    marginBottom: 3,
  },

  infoText: {
    color: '#586A7D',
    fontSize: 7,
    lineHeight: 10,
  },

  securityText: {
    color: '#536579',
    fontSize: 7.5,
    lineHeight: 11,
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
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
  },

  preview: {
    color: '#7C8590',
    fontSize: 6.3,
    marginTop: 9,
  },

  bottomIndicator: {
    width: 80,
    height: 3,
    backgroundColor: '#0B376B',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 18,
  },
});