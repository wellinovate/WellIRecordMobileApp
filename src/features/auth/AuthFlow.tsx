import React, { useMemo, useState } from "react";

import type { WelliApp } from "../../state/useWelliApp";

import { CreateAccountScreen } from "./screens/CreateAccountScreen";
import { CreateNewPasswordScreen } from "./screens/CreateNewPasswordScreen";
import { EmailVerificationScreen } from "./screens/EmailVerificationScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { GuidedProfileScreen } from "./screens/GuidedProfileScreen";
import { OtpVerificationScreen } from "./screens/OtpVerificationScreen";
import { PasswordResetSuccessScreen } from "./screens/PasswordResetSuccessScreen";
import { PhoneNumberScreen } from "./screens/PhoneNumberScreen";
import { RecoveryEmailSentScreen } from "./screens/RecoveryEmailSentScreen";
import { SuccessfulLoginScreen } from "./screens/SuccessfulLoginScreen";
import { WelcomeBackScreen } from "./screens/WelcomeBackScreen";

type Props = {
  app: WelliApp;
};

type AuthStep =
  | "welcome-back"
  | "create-account"
  | "email-verification"
  | "guided-profile"
  | "phone-number"
  | "otp-verification"
  | "successful-login"
  | "forgot-password"
  | "recovery-email-sent"
  | "create-new-password"
  | "password-reset-success";

type LooseRecord = Record<string, any>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function AuthFlow({ app }: Props) {
  const [step, setStep] = useState<AuthStep>("welcome-back");

  const [accountData, setAccountData] = useState<LooseRecord>({});
  const [profileData, setProfileData] = useState<LooseRecord>({});
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const fullName = useMemo(() => {
    const fromAccount = [
      accountData.firstName,
      accountData.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      fromAccount ||
      accountData.name ||
      profileData.name ||
      profileData.fullName ||
      ""
    );
  }, [accountData, profileData]);

  const firstName = useMemo(() => {
    if (accountData.firstName) {
      return String(accountData.firstName);
    }

    if (fullName) {
      return fullName.split(" ")[0] || "";
    }

    return "";
  }, [accountData, fullName]);

  const showAuthError = (error: unknown, fallback: string) => {
    app.actions.showToast(getErrorMessage(error, fallback));
  };

  const sendEmailOtpBestEffort = async (
    targetEmail: string,
    mode: "login" | "signup" = "signup",
  ) => {
    try {
      await app.actions.sendAuthOtp(
        targetEmail,
        "email",
        fullName || undefined,
        mode,
      );
    } catch (error) {
      /*
       * UI routing is currently the priority.
       * Keep the new flow navigable even while backend OTP integration
       * is being completed.
       */
      showAuthError(
        error,
        "Could not send the verification email yet.",
      );
    }
  };

  const sendPhoneOtpBestEffort = async (
    targetPhone: string,
  ) => {
    try {
      await app.actions.sendAuthOtp(
        targetPhone,
        "phone",
        fullName || undefined,
        "signup",
      );
    } catch (error) {
      showAuthError(
        error,
        "Could not send the verification code yet.",
      );
    }
  };

  const completeAccountCreation = async () => {
    const merged = {
      ...accountData,
      ...profileData,
      name:
        profileData.name ||
        profileData.fullName ||
        fullName,
      email:
        email ||
        accountData.email ||
        profileData.email ||
        "",
      phone:
        phoneNumber ||
        profileData.phone ||
        profileData.phoneNumber ||
        accountData.phone ||
        "",
      password:
        accountData.password ||
        newPassword ||
        "",
      dob:
        profileData.dob ||
        profileData.dateOfBirth ||
        accountData.dob ||
        "",
      bloodType:
        profileData.bloodType ||
        accountData.bloodType ||
        "",
      genotype:
        profileData.genotype ||
        accountData.genotype ||
        "",
      insuranceProvider:
        profileData.insuranceProvider ||
        profileData.hmoProvider ||
        accountData.insuranceProvider ||
        "",
      insuranceId:
        profileData.insuranceId ||
        profileData.hmoPolicyNumber ||
        accountData.insuranceId ||
        "",
    };

    try {
      await app.actions.signUpWithData(merged as any);
    } catch (error) {
      showAuthError(
        error,
        "Could not create your account. Please try again.",
      );
    }
  };

  switch (step) {
    case "create-account":
      return (
        <CreateAccountScreen
          onBack={() => setStep("welcome-back")}
          onSignIn={() => setStep("welcome-back")}
          onContinue={async (data: any) => {
            const nextEmail = String(data?.email ?? "").trim();

            setAccountData(data ?? {});
            setEmail(nextEmail);

            /*
             * Trigger the existing OTP action, but do not block UI routing
             * while backend verification is being finalized.
             */
            void sendEmailOtpBestEffort(nextEmail, "signup");

            setStep("email-verification");
          }}
        />
      );

    case "email-verification":
      return (
        <EmailVerificationScreen
          email={email}
          onBack={() => setStep("create-account")}
          onUseDifferentEmail={() => setStep("create-account")}
          onResend={() =>
            sendEmailOtpBestEffort(email, "signup")
          }
          onVerify={async (_code: string) => {
            /*
             * The visual flow continues to profile setup here.
             * Final account creation happens when the user enters the vault.
             */
            setStep("guided-profile");
          }}
        />
      );

    case "guided-profile": {
      /*
       * Cast only this component because its full callback prop signatures
       * were not included in the terminal output. Runtime export is known
       * to be a named function export.
       */
      const GuidedProfile =
        GuidedProfileScreen as React.ComponentType<any>;

      return (
        <GuidedProfile
          onBack={() => setStep("email-verification")}
          onReviewAllergies={() =>
            app.actions.showToast(
              "Allergy review will be connected to the profile editor.",
            )
          }
          onIdentityAndContact={() =>
            app.actions.showToast(
              "Identity and contact details are part of this guided profile.",
            )
          }
          onHealthAndCover={() =>
            app.actions.showToast(
              "Health and cover details are part of this guided profile.",
            )
          }
          onPreferences={() =>
            app.actions.showToast(
              "Preferences will be saved with your profile.",
            )
          }
          onSaveAndContinue={(data: any) => {
            if (data && typeof data === "object") {
              setProfileData(data);
            }

            setStep("phone-number");
          }}
        />
      );
    }

    case "phone-number": {
      const PhoneNumber =
        PhoneNumberScreen as React.ComponentType<any>;

      return (
        <PhoneNumber
          onBack={() => setStep("guided-profile")}
          onSendCode={async (value: string) => {
            const phone = String(value ?? "").trim();

            setPhoneNumber(phone);
            void sendPhoneOtpBestEffort(phone);
            setStep("otp-verification");
          }}
          onVerifyExistingCode={(value?: string) => {
            if (value) {
              setPhoneNumber(String(value));
            }

            setStep("otp-verification");
          }}
        />
      );
    }

    case "otp-verification": {
      const OtpVerification =
        OtpVerificationScreen as React.ComponentType<any>;

      return (
        <OtpVerification
          phoneNumber={phoneNumber}
          onBack={() => setStep("phone-number")}
          onChangePhoneNumber={() =>
            setStep("phone-number")
          }
          onResend={() =>
            sendPhoneOtpBestEffort(phoneNumber)
          }
          onVerify={async (_code: string) => {
            setStep("successful-login");
          }}
        />
      );
    }

    case "successful-login":
      return (
        <SuccessfulLoginScreen
          firstName={firstName}
          onEnterVault={() => {
            void completeAccountCreation();
          }}
        />
      );

    case "forgot-password":
      return (
        <ForgotPasswordScreen
          onBack={() => setStep("welcome-back")}
          onSendResetInstructions={async (
            targetEmail: string,
          ) => {
            const value = targetEmail.trim();

            setRecoveryEmail(value);

            /*
             * There is no dedicated password-reset action in useWelliApp
             * yet. Keep the new recovery UI routed without inventing a
             * backend mutation.
             */
            app.actions.showToast(
              `Recovery instructions requested for ${value}`,
            );

            setStep("recovery-email-sent");
          }}
        />
      );

    case "recovery-email-sent":
      return (
        <RecoveryEmailSentScreen
          email={recoveryEmail}
          onBack={() => setStep("forgot-password")}
          onChangeEmail={() => setStep("forgot-password")}
          onBackToSignIn={() => setStep("welcome-back")}
          onResend={async () => {
            app.actions.showToast(
              `Recovery instructions requested again for ${recoveryEmail}`,
            );
          }}
        />
      );

    case "create-new-password":
      return (
        <CreateNewPasswordScreen
          onBack={() => setStep("recovery-email-sent")}
          onBackToSignIn={() => setStep("welcome-back")}
          onSavePassword={async (password: string) => {
            setNewPassword(password);
            setStep("password-reset-success");
          }}
        />
      );

    case "password-reset-success":
      return (
        <PasswordResetSuccessScreen
          onBack={() => setStep("welcome-back")}
          onSignInWithNewPassword={() =>
            setStep("welcome-back")
          }
        />
      );

    case "welcome-back":
    default: {
      const WelcomeBack =
        WelcomeBackScreen as React.ComponentType<any>;

      return (
        <WelcomeBack
          onSignIn={async (
            identifier: string,
            password: string,
          ) => {
            try {
              await app.actions.signInWithCredentials(
                identifier,
                password,
              );
            } catch (error) {
              showAuthError(
                error,
                "Sign-in failed. Please check your details.",
              );
            }
          }}
          onForgotPassword={(typedEmail?: string) => {
            if (typedEmail) {
              setRecoveryEmail(typedEmail.trim());
            }

            setStep("forgot-password");
          }}
          onPhoneSignIn={() => setStep("phone-number")}
          onCreateAccount={() =>
            setStep("create-account")
          }
        />
      );
    }
  }
}

export default AuthFlow;
