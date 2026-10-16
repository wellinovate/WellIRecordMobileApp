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

export type GuidedProfileData = {
  emergencyContactName: string;
  relationship: string;
  emergencyContactPhone: string;
};

type Props = {
  onBack?: () => void;
  onReviewAllergies?: () => void;
  onIdentityAndContact?: () => void;
  onHealthAndCover?: () => void;
  onPreferences?: () => void;

  onSaveAndContinue: (
    data: GuidedProfileData,
  ) => Promise<void> | void;

  onFinishLater: () => Promise<void> | void;
};

export function GuidedProfileScreen({
  onBack,
  onReviewAllergies,
  onIdentityAndContact,
  onHealthAndCover,
  onPreferences,
  onSaveAndContinue,
  onFinishLater,
}: Props) {
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [finishingLater, setFinishingLater] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setError(null);
      setSaving(true);

      await onSaveAndContinue({
        emergencyContactName: contactName.trim(),
        relationship: relationship.trim(),
        emergencyContactPhone: contactPhone.trim(),
      });
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to save your profile details. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinishLater = async () => {
    try {
      setError(null);
      setFinishingLater(true);
      await onFinishLater();
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to continue right now. Please try again.',
      );
    } finally {
      setFinishingLater(false);
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            WelliRecord<Text style={styles.tradeMark}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.brandRow}>
          <LogoMark
            size={27}
            shieldColor="#092F67"
            markColor="#FFFFFF"
            strokeColor="#092F67"
          />

          <Text style={styles.brandText}>
            WelliRecord<Text style={styles.tradeMark}>™</Text>
          </Text>
        </View>

        <Text style={styles.eyebrow}>
          AFTER SIGNUP · PROFILE SETUP
        </Text>

        <Text style={styles.title}>Make it yours</Text>

        <Text style={styles.subtitle}>
          Add what matters. Optional details can wait.
        </Text>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>
              Profile setup · Safety first
            </Text>

            <Text style={styles.progressValue}>20%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <Text style={styles.progressDescription}>
            Start with allergy status and a person to contact in an
            emergency.
          </Text>
        </View>

        <View style={styles.allergyBanner}>
          <View style={styles.warningIcon}>
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
            >
              <Path
                d="M12 4L21 20H3L12 4Z"
                stroke="#456D9F"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />

              <Path
                d="M12 9V14"
                stroke="#456D9F"
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              <Circle
                cx={12}
                cy={17}
                r={0.8}
                fill="#456D9F"
              />
            </Svg>
          </View>

          <View style={styles.allergyContent}>
            <Text style={styles.allergyTitle}>
              Allergies: not recorded
            </Text>

            <Text style={styles.allergyText}>
              Not recorded is not the same as “No known allergies”.
              Confirm your status with your care team.
            </Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onReviewAllergies}
            style={styles.reviewRow}
          >
            <View style={styles.reviewIcon}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
              >
                <Path
                  d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
                  stroke="#173E73"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </Svg>
            </View>

            <View style={styles.reviewContent}>
              <Text style={styles.reviewTitle}>
                Review allergy status
              </Text>

              <Text style={styles.reviewSubtitle}>
                Share known allergies with your provider
              </Text>
            </View>

            <Svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
            >
              <Path
                d="M9 6L15 12L9 18"
                stroke="#42648B"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <ProfileInput
            label="Emergency contact name"
            value={contactName}
            onChangeText={setContactName}
            placeholder="Enter contact name"
            autoCapitalize="words"
          />

          <ProfileInput
            label="Relationship"
            value={relationship}
            onChangeText={setRelationship}
            placeholder="e.g. Partner, sibling or friend"
            autoCapitalize="words"
          />

          <ProfileInput
            label="Phone number"
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="Enter contact phone number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextHeading}>
            Next, at your own pace
          </Text>

          <ProfileNextItem
            title="Your identity & contact"
            subtitle="Legal / preferred name, DOB, address, photo"
            icon="person"
            onPress={onIdentityAndContact}
          />

          <ProfileNextItem
            title="Your health & cover"
            subtitle="Conditions, medicines, history and optional HMO"
            icon="health"
            onPress={onHealthAndCover}
          />

          <ProfileNextItem
            title="Your preferences"
            subtitle="Language, notifications and account security"
            icon="settings"
            onPress={onPreferences}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving || finishingLater}
          style={[
            styles.primaryButton,
            (saving || finishingLater) &&
              styles.disabledButton,
          ]}
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.primaryButtonText}>
              Save and continue
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleFinishLater}
          disabled={saving || finishingLater}
          style={[
            styles.secondaryButton,
            (saving || finishingLater) &&
              styles.disabledButton,
          ]}
        >
          {finishingLater ? (
            <ActivityIndicator
              size="small"
              color="#173B69"
            />
          ) : (
            <Text style={styles.secondaryButtonText}>
              Finish later
            </Text>
          )}
        </TouchableOpacity>


        <View style={styles.bottomIndicator} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type ProfileInputProps =
  React.ComponentProps<typeof TextInput> & {
    label: string;
  };

function ProfileInput({
  label,
  ...inputProps
}: ProfileInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        {...inputProps}
        placeholderTextColor="#212936"
        style={styles.input}
      />
    </View>
  );
}

function ProfileNextItem({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: 'person' | 'health' | 'settings';
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={onPress}
      style={styles.nextItem}
    >
      <View style={styles.nextIcon}>
        {icon === 'person' && (
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
          >
            <Circle
              cx={12}
              cy={8}
              r={3.2}
              stroke="#426791"
              strokeWidth={1.4}
            />

            <Path
              d="M6.5 19C6.8 15.8 8.8 14 12 14C15.2 14 17.2 15.8 17.5 19"
              stroke="#426791"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </Svg>
        )}

        {icon === 'health' && (
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
          >
            <Path
              d="M12 20S5 16.2 5 10.2C5 7.8 6.7 6 9 6C10.4 6 11.3 6.8 12 7.8C12.7 6.8 13.6 6 15 6C17.3 6 19 7.8 19 10.2C19 16.2 12 20 12 20Z"
              stroke="#426791"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </Svg>
        )}

        {icon === 'settings' && (
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
          >
            <Circle
              cx={12}
              cy={12}
              r={3}
              stroke="#426791"
              strokeWidth={1.4}
            />

            <Path
              d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M18.4 5.6L17 7M7 17L5.6 18.4"
              stroke="#426791"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </Svg>
        )}
      </View>

      <View style={styles.nextText}>
        <Text style={styles.nextTitle}>
          {title}
        </Text>

        <Text style={styles.nextSubtitle}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 42,
    marginBottom: 8,
  },

  backButton: {
    width: 31,
    height: 31,
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
    fontSize: 10,
    fontWeight: '600',
  },

  headerSpacer: {
    width: 31,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 3,
    marginBottom: 19,
  },

  brandText: {
    color: '#092F67',
    fontSize: 12,
    fontWeight: '800',
  },

  tradeMark: {
    fontSize: 6,
  },

  eyebrow: {
    color: '#53708C',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.35,
    marginBottom: 5,
  },

  title: {
    color: '#092C61',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.35,
  },

  subtitle: {
    color: '#4E5E71',
    fontSize: 10,
    marginTop: 3,
    marginBottom: 16,
  },

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 13,
    marginBottom: 12,
    shadowColor: '#172033',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressTitle: {
    color: '#173E72',
    fontSize: 10,
    fontWeight: '700',
  },

  progressValue: {
    color: '#7791AE',
    fontSize: 8.5,
  },

  progressTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: '#D8DEEA',
    marginTop: 13,
    marginBottom: 13,
    overflow: 'hidden',
  },

  progressFill: {
    width: '20%',
    height: '100%',
    backgroundColor: '#153D74',
    borderRadius: 3,
  },

  progressDescription: {
    color: '#4E6074',
    fontSize: 8,
    lineHeight: 11,
    maxWidth: 230,
  },

  allergyBanner: {
    backgroundColor: '#EEF2FA',
    borderWidth: 1,
    borderColor: '#D4DDEC',
    borderRadius: 10,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },

  warningIcon: {
    width: 23,
    paddingTop: 1,
  },

  allergyContent: {
    flex: 1,
  },

  allergyTitle: {
    color: '#183962',
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 3,
  },

  allergyText: {
    color: '#53687E',
    fontSize: 7.7,
    lineHeight: 11,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 8,
    marginBottom: 12,
    shadowColor: '#162135',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  reviewIcon: {
    width: 29,
    height: 29,
    borderRadius: 7,
    backgroundColor: '#F1F4F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  reviewContent: {
    flex: 1,
  },

  reviewTitle: {
    color: '#153B69',
    fontSize: 9.5,
    fontWeight: '700',
  },

  reviewSubtitle: {
    color: '#627388',
    fontSize: 7.4,
    marginTop: 2,
  },

  field: {
    marginBottom: 9,
  },

  fieldLabel: {
    color: '#173D70',
    fontSize: 8,
    marginBottom: 3,
  },

  input: {
    minHeight: 29,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E8ED',
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#151922',
    fontSize: 9.5,
  },

  nextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    shadowColor: '#162135',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  nextHeading: {
    color: '#173B68',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 9,
  },

  nextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },

  nextIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#F1F4F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  nextText: {
    flex: 1,
  },

  nextTitle: {
    color: '#173A68',
    fontSize: 9,
    fontWeight: '700',
  },

  nextSubtitle: {
    color: '#66778A',
    fontSize: 7.3,
    lineHeight: 10,
    marginTop: 1,
  },

  errorBox: {
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F0C2C2',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginBottom: 9,
  },

  errorText: {
    color: '#A52D2D',
    fontSize: 8.5,
  },

  primaryButton: {
    minHeight: 39,
    borderRadius: 7,
    backgroundColor: '#082F67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '500',
  },

  secondaryButton: {
    minHeight: 36,
    borderRadius: 7,
    backgroundColor: '#EDF1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: '#183C69',
    fontSize: 9.5,
    fontWeight: '500',
  },

  disabledButton: {
    opacity: 0.65,
  },

  previewNotice: {
    color: '#666D77',
    fontSize: 7,
    textAlign: 'center',
    marginTop: 11,
  },

  bottomIndicator: {
    width: 92,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0B376B',
    alignSelf: 'center',
    marginTop: 14,
  },
});