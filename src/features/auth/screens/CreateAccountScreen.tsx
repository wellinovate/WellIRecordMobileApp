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

import { FormSelect } from '../../../components/FormSelect';
import { SocialAuthButtons, type SocialDetails } from '../../../components/SocialAuthButtons';

import { STATE_NAMES } from '../../../data/nigeriaRegions';



export type CreateAccountData = {

  firstName: string;

  lastName: string;

  dob: string;

  email: string;

  phone: string;

  country: string;

  state: string;

  gender: 'female' | 'male' | 'prefer-not-to-say' | '';

  password: string;

};



type Props = {
  /** Google or Apple sign-up. A new account is asked for its state next. */
  onSocial?: (details: SocialDetails) => void;
  onSocialError?: (message: string) => void;

  onBack?: () => void;

  onContinue: (data: CreateAccountData) => Promise<void> | void;

  onSignIn?: () => void;

};



export function CreateAccountScreen({

  onBack,

  onContinue,

  onSignIn,
  onSocial,
  onSocialError,
}: Props) {

  const [firstName, setFirstName] = useState('');

  const [lastName, setLastName] = useState('');

  const [dob, setDob] = useState('');

  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');

  const [country] = useState('Nigeria');
  const [stateName, setStateName] = useState('');

  const [gender, setGender] =

    useState<CreateAccountData['gender']>('');

  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');

  const [agreeTerms, setAgreeTerms] = useState(false);



  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);



  const handleContinue = async () => {

    setError(null);



    if (!firstName.trim()) {

      setError('Enter your first name.');

      return;

    }



    if (!lastName.trim()) {

      setError('Enter your last name.');

      return;

    }



    if (!dob.trim()) {

      setError('Select your date of birth.');

      return;

    }



    if (!email.trim()) {

      setError('Enter your email address.');

      return;

    }



    if (!phone.trim()) {

      setError('Enter your phone number.');

      return;

    }



    if (!stateName) {

      setError('Select your state of residence.');

      return;

    }

    if (password.length < 8) {

      setError('Password must contain at least 8 characters.');

      return;

    }



    if (password !== confirmPassword) {

      setError('Passwords do not match.');

      return;

    }



    if (!agreeTerms) {

      setError('You must accept the Terms of Service and Privacy Policy.');

      return;

    }



    try {

      setSubmitting(true);



      await onContinue({

        firstName: firstName.trim(),

        lastName: lastName.trim(),

        dob: dob.trim(),

        email: email.trim(),

        phone: phone.trim(),

        country,

        state: stateName,

        gender,

        password,

      });

    } catch (err: any) {

      setError(err?.message || 'Unable to continue. Please try again.');

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

        <View style={styles.topRow}>

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

        </View>



        <View style={styles.brandRow}>

          <LogoMark

            size={31}

            shieldColor="#082D63"

            markColor="#FFFFFF"

            strokeColor="#082D63"

          />



          <Text style={styles.brandText}>

            WelliRecord<Text style={styles.tradeMark}>™</Text>

          </Text>

        </View>



        <Text style={styles.eyebrow}>ACCOUNT · STEP 1 OF 2</Text>



        <Text style={styles.title}>Start your record</Text>



        <Text style={styles.subtitle}>

          A few details to make your record yours.

        </Text>






        {error && (

          <View style={styles.errorBox}>

            <Text style={styles.errorText}>{error}</Text>

          </View>

        )}



        <UnderlineField

          label="First name"

          required

          value={firstName}

          onChangeText={setFirstName}

          placeholder="Enter first name"

          autoCapitalize="words"

        />



        <UnderlineField

          label="Last name"

          required

          value={lastName}

          onChangeText={setLastName}

          placeholder="Enter last name"

          autoCapitalize="words"

        />



        <UnderlineField

          label="Date of birth"

          required

          value={dob}

          onChangeText={setDob}

          placeholder="Select date of birth"

        />



        <UnderlineField

          label="Email address"

          required

          value={email}

          onChangeText={setEmail}

          placeholder="you\@example.com"

          keyboardType="email-address"

          autoCapitalize="none"

        />



        <View style={styles.field}>

          <Text style={styles.fieldLabel}>

            Phone number<Text style={styles.required}> *</Text>

          </Text>



          <View style={styles.phoneRow}>

            <Text style={styles.countryCode}>+234</Text>

            <Text style={styles.phoneSeparator}>•</Text>



            <TextInput

              value={phone}

              onChangeText={setPhone}

              placeholder="Phone number"

              placeholderTextColor="#242B3A"

              keyboardType="phone-pad"

              style={styles.phoneInput}

            />

          </View>

        </View>



        <View style={styles.field}>

          <Text style={styles.fieldLabel}>

            Country of residence<Text style={styles.required}> *</Text>

          </Text>



          <TouchableOpacity

            activeOpacity={0.7}

            style={styles.countrySelector}

          >

            <Text style={styles.countryText}>{country}</Text>



            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">

              <Path

                d="M7 10L12 15L17 10"

                stroke="#6D7687"

                strokeWidth={1.6}

                strokeLinecap="round"

                strokeLinejoin="round"

              />

            </Svg>

          </TouchableOpacity>

        </View>

        <View style={styles.field}>

          <Text style={styles.fieldLabel}>

            State of residence<Text style={styles.required}> *</Text>

          </Text>

          <FormSelect value={stateName} onChange={setStateName} options={STATE_NAMES} placeholder="Select your state" />

        </View>




        <View style={styles.genderSection}>

          <Text style={styles.genderLabel}>Gender optional</Text>



          <GenderOption

            label="Female"

            selected={gender === 'female'}

            onPress={() => setGender('female')}

          />



          <GenderOption

            label="Male"

            selected={gender === 'male'}

            onPress={() => setGender('male')}

          />



          <GenderOption

            label="Prefer not to say"

            selected={gender === 'prefer-not-to-say'}

            onPress={() => setGender('prefer-not-to-say')}

          />

        </View>



        <UnderlineField

          label="Password"

          required

          value={password}

          onChangeText={setPassword}

          placeholder="Create a password"

          secureTextEntry

          autoCapitalize="none"

        />



        <Text style={styles.passwordHint}>

          Choose a strong, unique password.

        </Text>



        <UnderlineField

          label="Confirm password"

          required

          value={confirmPassword}

          onChangeText={setConfirmPassword}

          placeholder="Re-enter your password"

          secureTextEntry

          autoCapitalize="none"

        />



        <TouchableOpacity

          activeOpacity={0.7}

          onPress={() => setAgreeTerms((current) => !current)}

          style={styles.termsRow}

        >

          <View

            style={[

              styles.checkbox,

              agreeTerms && styles.checkboxSelected,

            ]}

          >

            {agreeTerms && (

              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">

                <Path

                  d="M5 12.5L9.5 17L19 7"

                  stroke="#FFFFFF"

                  strokeWidth={2.6}

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

              </Svg>

            )}

          </View>



          <Text style={styles.termsText}>

            I agree to the{' '}

            <Text style={styles.termsLink}>Terms of Service</Text> and have

            read the <Text style={styles.termsLink}>Privacy Policy.</Text>

          </Text>

        </TouchableOpacity>



        <TouchableOpacity

          activeOpacity={0.86}

          onPress={handleContinue}

          disabled={submitting}

          style={[

            styles.continueButton,

            submitting && styles.continueButtonDisabled,

          ]}

        >

          {submitting ? (

            <ActivityIndicator size="small" color="#FFFFFF" />

          ) : (

            <Text style={styles.continueButtonText}>

              Continue to verification

            </Text>

          )}

        </TouchableOpacity>

        {onSocial ? (
          <SocialAuthButtons
            labelPrefix="Sign up with"
            dividerText="or sign up with"
            onSuccess={onSocial}
            onError={onSocialError}
          />
        ) : null}



        <View style={styles.ownershipCard}>

          <View style={styles.shieldIcon}>

            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">

              <Path

                d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"

                stroke="#123E75"

                strokeWidth={1.6}

                strokeLinejoin="round"

              />

              <Path

                d="M9.5 12L11 13.5L14.5 10"

                stroke="#123E75"

                strokeWidth={1.6}

                strokeLinecap="round"

                strokeLinejoin="round"

              />

            </Svg>

          </View>



          <View style={styles.ownershipContent}>

            <Text style={styles.ownershipTitle}>

              Your record belongs to you

            </Text>



            <Text style={styles.ownershipText}>

              You control sharing. Guided profile completion comes after

              signup.

            </Text>

          </View>

        </View>



        <TouchableOpacity

          activeOpacity={0.7}

          onPress={onSignIn}

          style={styles.signInButton}

        >

          <Text style={styles.signInText}>

            Already have an account?{' '}

            <Text style={styles.signInLink}>Sign in</Text>

          </Text>

        </TouchableOpacity>



        <View style={styles.bottomIndicator} />

      </ScrollView>

    </KeyboardAvoidingView>

  );

}



type UnderlineFieldProps = React.ComponentProps<typeof TextInput> & {

  label: string;

  required?: boolean;

};



function UnderlineField({

  label,

  required,

  ...inputProps

}: UnderlineFieldProps) {

  return (

    <View style={styles.field}>

      <Text style={styles.fieldLabel}>

        {label}

        {required && <Text style={styles.required}> *</Text>}

      </Text>



      <TextInput

        {...inputProps}

        placeholderTextColor="#242B3A"

        style={styles.underlineInput}

      />

    </View>

  );

}



function GenderOption({

  label,

  selected,

  onPress,

}: {

  label: string;

  selected: boolean;

  onPress: () => void;

}) {

  return (

    <TouchableOpacity

      activeOpacity={0.7}

      onPress={onPress}

      style={[

        styles.genderOption,

        selected && styles.genderOptionSelected,

      ]}

    >

      <View style={styles.radioOuter}>

        {selected && <View style={styles.radioInner} />}

      </View>



      <Text style={styles.genderOptionText}>{label}</Text>

    </TouchableOpacity>

  );

}



const styles = StyleSheet.create({

  root: {

    flex: 1,

    backgroundColor: '#FFFFFF',

  },



  content: {

    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 24,

  },



  topRow: {

    height: 38,

    justifyContent: 'center',

  },



  backButton: {

    width: 30,

    height: 30,

    borderRadius: 15,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F7F8FA',

    shadowColor: '#000000',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.07,

    shadowRadius: 5,

    elevation: 2,

  },



  brandRow: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 14,

    marginBottom: 24,

    gap: 8,

  },



  brandText: {

    color: '#092B5B',

    fontSize: 16,

    fontWeight: '800',

  },



  tradeMark: {

    fontSize: 11,

  },



  eyebrow: {

    color: '#47617C',

    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 0.3,

    marginBottom: 5,

  },



  title: {

    color: '#092B5B',

    fontSize: 28,

    lineHeight: 34,

    fontWeight: '800',

    letterSpacing: -0.35,

  },



  subtitle: {

    color: '#818896',

    fontSize: 14,

    marginTop: 2,

    marginBottom: 20,

  },



  previewNotice: {

    color: '#323743',

    fontSize: 11,

    marginBottom: 20,

  },



  errorBox: {

    backgroundColor: '#FFF4F4',

    borderWidth: 1,

    borderColor: '#F2C6C6',

    borderRadius: 7,

    paddingHorizontal: 10,

    paddingVertical: 8,

    marginBottom: 14,

  },



  errorText: {

    color: '#A52B2B',

    fontSize: 12,

  },



  field: {

    marginBottom: 18,

  },



  fieldLabel: {

    color: '#173B68',

    fontSize: 12,

    marginBottom: 5,

  },



  required: {

    color: '#173B68',

  },



  underlineInput: {

    minHeight: 46,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: '#E4E8ED',

    paddingHorizontal: 8,

    paddingVertical: 10,

    color: '#151922',

    fontSize: 14,

  },



  phoneRow: {

    minHeight: 46,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: '#E4E8ED',

    paddingHorizontal: 8,

  },



  countryCode: {

    color: '#151922',

    fontSize: 14,

    fontWeight: '600',

  },



  phoneSeparator: {

    marginHorizontal: 8,

    color: '#666E7D',

    fontSize: 12,

  },



  phoneInput: {

    flex: 1,

    minHeight: 46,

    paddingVertical: 10,

    color: '#151922',

    fontSize: 14,

  },



  countrySelector: {

    minHeight: 46,

    borderWidth: 1,

    borderColor: '#D7DEE8',

    borderRadius: 7,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 9,

  },



  countryText: {

    color: '#1A2532',

    fontSize: 12,

  },



  genderSection: {

    marginBottom: 18,

  },



  genderLabel: {

    color: '#173B68',

    fontSize: 12,

    marginBottom: 6,

  },



  genderOption: {

    minHeight: 46,

    borderWidth: 1,

    borderColor: '#D7DEE8',

    borderRadius: 6,

    paddingHorizontal: 8,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 5,

  },



  genderOptionSelected: {

    borderColor: '#8CA6C5',

    backgroundColor: '#FBFCFE',

  },



  genderOptionText: {

    color: '#2C3543',

    fontSize: 12,

    marginLeft: 7,

  },



  radioOuter: {

    width: 16,

    height: 16,

    borderRadius: 6,

    borderWidth: 1,

    borderColor: '#44688F',

    alignItems: 'center',

    justifyContent: 'center',

  },



  radioInner: {

    width: 8,

    height: 8,

    borderRadius: 3,

    backgroundColor: '#123E75',

  },



  passwordHint: {

    color: '#5E6570',

    fontSize: 11,

    marginTop: -8,

    marginBottom: 10,

  },



  termsRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    marginTop: 2,

    marginBottom: 14,

  },



  checkbox: {

    width: 18,

    height: 18,

    borderRadius: 2,

    borderWidth: 1,

    borderColor: '#5B7594',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 1,

    marginRight: 7,

  },



  checkboxSelected: {

    backgroundColor: '#092F67',

    borderColor: '#092F67',

  },



  termsText: {

    flex: 1,

    color: '#324052',

    fontSize: 11,

    lineHeight: 17,

  },



  termsLink: {

    color: '#113F75',

    fontWeight: '600',

  },



  continueButton: {

    minHeight: 48,

    borderRadius: 7,

    backgroundColor: '#082E64',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 10,

  },



  continueButtonDisabled: {

    opacity: 0.7,

  },



  continueButtonText: {

    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '600',

  },



  ownershipCard: {

    flexDirection: 'row',

    backgroundColor: '#F0F3FA',

    borderRadius: 8,

    paddingHorizontal: 11,

    paddingVertical: 10,

    marginBottom: 14,

  },



  shieldIcon: {

    width: 22,

    alignItems: 'flex-start',

    paddingTop: 1,

  },



  ownershipContent: {

    flex: 1,

  },



  ownershipTitle: {

    color: '#142C4A',

    fontSize: 13,

    fontWeight: '700',

    marginBottom: 2,

  },



  ownershipText: {

    color: '#758091',

    fontSize: 11.5,

    lineHeight: 16,

  },



  signInButton: {

    alignItems: 'center',

    paddingVertical: 10,

  },



  signInText: {

    color: '#596579',

    fontSize: 11,

  },



  signInLink: {

    color: '#173F73',

    fontWeight: '600',

  },



  bottomIndicator: {

    width: 95,

    height: 3,

    borderRadius: 2,

    backgroundColor: '#0B376B',

    alignSelf: 'center',

    marginTop: 13,

  },

});