export type AuthStep =
  | "create-account"
  | "email-verification"
  | "guided-profile"
  | "welcome-back"
  | "phone-number"
  | "otp-verification"
  | "successful-login"
  | "forgot-password"
  | "recovery-email-sent"
  | "create-new-password"
  | "password-reset-success";

export type AuthMode = "signin" | "signup";

export interface PendingAuth {
  mode: AuthMode;
  identifier: string;
  channel: "phone" | "email";
}

export type Gender = "female" | "male" | "prefer-not-to-say" | "";

export interface CreateAccountDraft {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  country: string;
  gender: Gender;
  password: string;
}

export interface PendingAuth {
  mode: "signin" | "signup";
  identifier: string;
  channel: "phone" | "email";
}
