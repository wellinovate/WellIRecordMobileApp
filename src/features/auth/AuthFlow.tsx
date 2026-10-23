import React, { useMemo, useState } from 'react';

import type { WelliApp } from '../../state/useWelliApp';
import { authService, type AuthSession } from '../../services/authService';

import { CreateAccountScreen } from './screens/CreateAccountScreen';
import { CreateNewPasswordScreen } from './screens/CreateNewPasswordScreen';
import { EmailVerificationScreen } from './screens/EmailVerificationScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { GuidedProfileScreen } from './screens/GuidedProfileScreen';
import { OtpVerificationScreen } from './screens/OtpVerificationScreen';
import { PasswordResetSuccessScreen } from './screens/PasswordResetSuccessScreen';
import { PhoneNumberScreen } from './screens/PhoneNumberScreen';
import { RecoveryEmailSentScreen } from './screens/RecoveryEmailSentScreen';
import { SuccessfulLoginScreen } from './screens/SuccessfulLoginScreen';
import { WelcomeBackScreen } from './screens/WelcomeBackScreen';

type Props = {
  app: WelliApp;
};

type AuthStep =
  | 'welcome-back'
  | 'create-account'
  | 'email-verification'
  | 'guided-profile'
  | 'phone-number'
  | 'otp-verification'
  | 'successful-login'
  | 'forgot-password'
  | 'recovery-email-sent'
  | 'create-new-password'
  | 'password-reset-success';

type AuthIntent = 'signup' | 'password-login' | 'phone-login' | 'email-login';
type VerificationChannel = 'email' | 'phone';
type LooseRecord = Record<string, any>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function AuthFlow({ app }: Props) {
  const [step, setStep] = useState<AuthStep>('welcome-back');
  const [intent, setIntent] = useState<AuthIntent>('password-login');

  const [accountData, setAccountData] = useState<LooseRecord>({});
  const [profileData, setProfileData] = useState<LooseRecord>({});
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [verificationIdentifier, setVerificationIdentifier] = useState('');
  const [pendingSession, setPendingSession] =
    useState<AuthSession | null>(null);

  const fullName = useMemo(() => {
    const fromAccount = [accountData.firstName, accountData.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return (
      fromAccount ||
      accountData.name ||
      profileData.name ||
      profileData.fullName ||
      pendingSession?.user.fullName ||
      ''
    );
  }, [accountData, pendingSession, profileData]);

  const firstName = useMemo(() => {
    const sessionName = pendingSession?.user.fullName?.trim();
    if (sessionName) return sessionName.split(/\s+/)[0] || '';

    if (accountData.firstName) {
      return String(accountData.firstName);
    }

    if (fullName) {
      return fullName.split(/\s+/)[0] || '';
    }

    return '';
  }, [accountData, fullName, pendingSession]);

  const showAuthError = (error: unknown, fallback: string) => {
    app.actions.showToast(getErrorMessage(error, fallback));
  };

  const registrationData = () => ({
    ...accountData,
    ...profileData,
    name: profileData.name || profileData.fullName || fullName,
    email: email || accountData.email || profileData.email || '',
    phone:
      phoneNumber ||
      profileData.phone ||
      profileData.phoneNumber ||
      accountData.phone ||
      '',
    password: accountData.password || newPassword || '',
    dob: profileData.dob || profileData.dateOfBirth || accountData.dob || '',
    bloodType: profileData.bloodType || accountData.bloodType || '',
    genotype: profileData.genotype || accountData.genotype || '',
    insuranceProvider:
      profileData.insuranceProvider ||
      profileData.hmoProvider ||
      accountData.insuranceProvider ||
      '',
    insuranceId:
      profileData.insuranceId ||
      profileData.hmoPolicyNumber ||
      accountData.insuranceId ||
      '',
  });

  const resetToWelcome = () => {
    setIntent('password-login');
    setPendingSession(null);
    setVerificationIdentifier('');
    setStep('welcome-back');
  };

  const routePreparedLogin = (prepared: {
    session: AuthSession;
    identifier: string;
    channel: VerificationChannel;
  }) => {
    setIntent('password-login');
    setPendingSession(prepared.session);
    setVerificationIdentifier(prepared.identifier);

    if (prepared.channel === 'email') {
      setEmail(prepared.identifier);
      setStep('email-verification');
    } else {
      setPhoneNumber(prepared.identifier);
      setStep('otp-verification');
    }
  };

  const signInWithSocial = (d: { provider: 'google' | 'apple'; fullName?: string; email?: string; avatar?: string; clerkToken?: string }) => {
    app.actions
      .signInWithClerk({ provider: d.provider, fullName: d.fullName, email: d.email, avatar: d.avatar, clerkToken: d.clerkToken })
      .catch(() => {
        /* signInWithClerk already showed the reason */
      });
  };

  switch (step) {
    case 'create-account':
      return (
        <CreateAccountScreen
          onBack={resetToWelcome}
          onSignIn={resetToWelcome}
          onSocial={signInWithSocial}
          onSocialError={(m) => showAuthError(new Error(m), m)}
          onContinue={async (data: any) => {
            const nextEmail = String(data?.email ?? '')
              .trim()
              .toLowerCase();

            setIntent('signup');
            setAccountData(data ?? {});
            setEmail(nextEmail);
            setVerificationIdentifier(nextEmail);
                    setPendingSession(null);

            try {
              await app.actions.sendAuthOtp(
                nextEmail,
                'email',
                [data?.firstName, data?.lastName].filter(Boolean).join(' ') ||
                  data?.name ||
                  undefined,
                'signup',
              );
              setStep('email-verification');
            } catch (error) {
              showAuthError(
                error,
                'Could not send the verification email. Please try again.',
              );
              throw error;
            }
          }}
        />
      );

    case 'email-verification': {
      const isSignup = intent === 'signup';
      const targetEmail = isSignup ? email : verificationIdentifier;

      return (
        <EmailVerificationScreen
          email={targetEmail}
          purpose={isSignup ? 'signup' : 'login'}
          onBack={() => {
            if (isSignup) {
              setStep('create-account');
            } else {
              resetToWelcome();
            }
          }}
          onUseDifferentEmail={() => {
            if (isSignup) {
              setStep('create-account');
            } else {
              resetToWelcome();
            }
          }}
          onResend={async () => {
            await app.actions.sendAuthOtp(
              targetEmail,
              'email',
              isSignup ? fullName || undefined : pendingSession?.user.fullName,
              isSignup ? 'signup' : 'login',
            );
          }}
          onVerify={async (code: string) => {
            if (isSignup) {
              await app.actions.verifyOtpOnly(targetEmail, code, undefined, { state: (accountData as any)?.state, lga: (accountData as any)?.lga });
              setStep('guided-profile');
              return;
            }

            const verifiedSession = await app.actions.verifyPendingAuthOtp(
              targetEmail,
              code,
              pendingSession,
            );

            setPendingSession(verifiedSession);
            setStep('successful-login');
          }}
        />
      );
    }

    case 'guided-profile': {
      const GuidedProfile =
        GuidedProfileScreen as React.ComponentType<any>;

      return (
        <GuidedProfile
          onBack={() => setStep('email-verification')}
          onIdentityAndContact={() =>
            app.actions.showToast(
              'Identity and contact details are part of this guided profile.',
            )
          }
          onHealthAndCover={() =>
            app.actions.showToast(
              'Health and cover details are part of this guided profile.',
            )
          }
          onPreferences={() =>
            app.actions.showToast(
              'Preferences will be saved with your profile.',
            )
          }
          onSaveAndContinue={(data: any) => {
            if (data && typeof data === 'object') {
              setProfileData(data);
            }

            setIntent('signup');
            setStep('phone-number');
          }}
        />
      );
    }

    case 'phone-number': {
      const PhoneNumber =
        PhoneNumberScreen as React.ComponentType<any>;
      const isSignup = intent === 'signup';

      return (
        <PhoneNumber
          purpose={isSignup ? 'signup' : 'login'}
          onBack={() => {
            if (isSignup) {
              setStep('guided-profile');
            } else {
              resetToWelcome();
            }
          }}
          onSendCode={async (value: string) => {
            const phone = String(value ?? '').trim();

            await app.actions.sendAuthOtp(
              phone,
              'phone',
              isSignup ? fullName || undefined : undefined,
              isSignup ? 'signup' : 'login',
            );

            setPhoneNumber(phone);
            setVerificationIdentifier(phone);
            setStep('otp-verification');
          }}
          onVerifyExistingCode={(value: string) => {
            const phone = String(value ?? '').trim();
            setPhoneNumber(phone);
            setVerificationIdentifier(phone);
            setStep('otp-verification');
          }}
        />
      );
    }

    case 'otp-verification': {
      const OtpVerification =
        OtpVerificationScreen as React.ComponentType<any>;
      const isSignup = intent === 'signup';
      const targetPhone = verificationIdentifier || phoneNumber;

      return (
        <OtpVerification
          phoneNumber={targetPhone}
          purpose={isSignup ? 'signup' : 'login'}
          onBack={() => {
            if (intent === 'password-login') {
              resetToWelcome();
            } else {
              setStep('phone-number');
            }
          }}
          onChangePhoneNumber={() => {
            if (intent === 'password-login') {
              resetToWelcome();
            } else {
              setStep('phone-number');
            }
          }}
          onResend={() =>
            app.actions.sendAuthOtp(
              targetPhone,
              'phone',
              isSignup ? fullName || undefined : pendingSession?.user.fullName,
              isSignup ? 'signup' : 'login',
            )
          }
          onVerify={async (code: string) => {
            if (isSignup) {
              await app.actions.verifyOtpOnly(targetPhone, code, undefined, { state: (accountData as any)?.state, lga: (accountData as any)?.lga });

              const preparedSession =
                await app.actions.prepareSignUpWithData(
                  registrationData() as any,
                );

              setPendingSession(preparedSession);
              setStep('successful-login');
              return;
            }

            const verifiedSession = await app.actions.verifyPendingAuthOtp(
              targetPhone,
              code,
              pendingSession,
            );

            setPendingSession(verifiedSession);
            setStep('successful-login');
          }}
        />
      );
    }

    case 'successful-login':
      return (
        <SuccessfulLoginScreen
          firstName={firstName}
          onEnterVault={async () => {
            if (!pendingSession) {
              throw new Error(
                'Your verified session is missing. Please sign in again.',
              );
            }

            await app.actions.completeAuthSession(pendingSession, {
              mode: intent === 'signup' ? 'signup' : 'login',
              profile:
                intent === 'signup'
                  ? (registrationData() as any)
                  : undefined,
            });
          }}
        />
      );

    case 'forgot-password':
      return (
        <ForgotPasswordScreen
          onBack={resetToWelcome}
          onSendResetInstructions={async (targetEmail: string) => {
            const value = targetEmail.trim();

            setRecoveryEmail(value);

            try {
              await authService.requestPasswordReset(value);
            } catch (error) {
              showAuthError(
                error,
                'Could not send the reset code. Check your connection and try again.',
              );
              throw error;
            }

            setStep('recovery-email-sent');
          }}
        />
      );

    case 'recovery-email-sent':
      return (
        <RecoveryEmailSentScreen
          email={recoveryEmail}
          onBack={() => setStep('forgot-password')}
          onChangeEmail={() => setStep('forgot-password')}
          onBackToSignIn={resetToWelcome}
          onContinue={() => setStep('create-new-password')}
          onResend={async () => {
            await authService.requestPasswordReset(recoveryEmail);
          }}
        />
      );

    case 'create-new-password':
      return (
        <CreateNewPasswordScreen
          onBack={() => setStep('recovery-email-sent')}
          onBackToSignIn={resetToWelcome}
          onSavePassword={async (password: string, code: string) => {
            await authService.resetPassword(recoveryEmail, code, password);
            setNewPassword('');
            setStep('password-reset-success');
          }}
        />
      );

    case 'password-reset-success':
      return (
        <PasswordResetSuccessScreen
          onBack={resetToWelcome}
          onSignInWithNewPassword={resetToWelcome}
        />
      );

    case 'welcome-back':
    default: {
      const WelcomeBack =
        WelcomeBackScreen as React.ComponentType<any>;

      return (
        <WelcomeBack
          onSocial={signInWithSocial}
          onSocialError={(m: string) => showAuthError(new Error(m), m)}
          onSignIn={async (
            identifier: string,
            password: string,
          ) => {
            try {
              const prepared =
                await app.actions.preparePasswordSignIn(
                  identifier,
                  password,
                );

              routePreparedLogin(prepared);
            } catch (error) {
              showAuthError(
                error,
                'Sign-in failed. Please check your details.',
              );
              throw error;
            }
          }}
          onForgotPassword={(typedEmail?: string) => {
            if (typedEmail) {
              setRecoveryEmail(typedEmail.trim());
            }

            setStep('forgot-password');
          }}
          onEmailCodeSignIn={async (typedEmail: string) => {
            const target = typedEmail.trim().toLowerCase();

            try {
              await app.actions.sendAuthOtp(target, 'email', undefined, 'login');
            } catch (error) {
              showAuthError(
                error,
                'Could not send a sign-in code. Check the email address and try again.',
              );
              throw error;
            }

            setIntent('email-login');
            setPendingSession(null);
            setEmail(target);
            setVerificationIdentifier(target);
            setStep('email-verification');
          }}
          onPhoneSignIn={() => {
            setIntent('phone-login');
            setPendingSession(null);
            setVerificationIdentifier('');
            setStep('phone-number');
          }}
          onCreateAccount={() => {
            setIntent('signup');
            setPendingSession(null);
            setStep('create-account');
          }}
        />
      );
    }
  }
}

export default AuthFlow;
