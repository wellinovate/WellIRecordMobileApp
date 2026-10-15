import React, { useState } from "react";

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
} from "react-native";

import Svg, { Path } from "react-native-svg";

import { LogoMark } from "../../../components/Logo";

type Props = {
  onSignIn: (
    email: string,

    password: string,
  ) => Promise<void> | void;

  onForgotPassword?: (email: string) => Promise<void> | void;

  onPhoneSignIn?: () => void;

  onCreateAccount?: () => void;
};

export function WelcomeBackScreen({
  onSignIn,

  onForgotPassword,

  onPhoneSignIn,

  onCreateAccount,
}: Props) {
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter your registered email address.");

      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");

      return;
    }

    if (!password) {
      setError("Enter your password.");

      return;
    }

    try {
      setError(null);

      setSubmitting(true);

      await onSignIn(normalizedEmail, password);
    } catch (err: any) {
      setError(
        err?.message || "Unable to sign in. Check your details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setError(null);

      setResettingPassword(true);

      await onForgotPassword?.(email.trim().toLowerCase());
    } catch (err: any) {
      setError(err?.message || "Unable to start password recovery.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}

      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}

        contentContainerStyle={styles.content}

        keyboardShouldPersistTaps="handled"

        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoCard}>
            <LogoMark
              size={58}

              shieldColor="#0B3268"

              markColor="#FFFFFF"

              strokeColor="#0B3268"
            />
          </View>
        </View>

        <Text style={styles.title}>
          Welcome Back 
          <Text style={styles.tradeMark}>™</Text>
        </Text>

        <Text style={styles.subtitle}>
          Your health records, always within reach.
        </Text>

        <Text style={styles.description}>
          Sign in securely to access your health vault, manage your medical
          history, appointments, medications, and more.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email address</Text>

          <TextInput
            value={email}

            onChangeText={(value) => {
              setEmail(value);

              setError(null);
            }}

            placeholder="Enter your registered email address."

            placeholderTextColor="#202733"

            autoCapitalize="none"

            autoCorrect={false}

            keyboardType="email-address"

            textContentType="emailAddress"

            autoComplete="email"

            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.passwordLabelRow}>
            <Text style={styles.fieldLabel}>Password</Text>

            <TouchableOpacity
              activeOpacity={0.7}

              onPress={handleForgotPassword}

              disabled={resettingPassword}
            >
              {resettingPassword ? (
                <ActivityIndicator
                  size="small"

                  color="#0B3268"
                />
              ) : (
                <Text style={styles.forgotText}>Forgot Password?</Text>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            value={password}

            onChangeText={(value) => {
              setPassword(value);

              setError(null);
            }}

            placeholder="Enter your password."

            placeholderTextColor="#202733"

            secureTextEntry

            textContentType="password"

            autoComplete="current-password"

            style={styles.input}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}

          onPress={handleSignIn}

          disabled={submitting}

          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator
              size="small"

              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.primaryButtonText}>Continue Securely</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />

          <Text style={styles.dividerText}>Or</Text>

          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          activeOpacity={0.8}

          onPress={onPhoneSignIn}

          style={styles.phoneButton}
        >
          <Text style={styles.phoneButtonText}>Sign in with phone</Text>
        </TouchableOpacity>

        <View style={styles.createAccountRow}>
          <Text style={styles.createAccountText}>Don't have an account? </Text>

          <TouchableOpacity
            activeOpacity={0.7}

            onPress={onCreateAccount}
          >
            <Text style={styles.createAccountLink}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityCard}>
          <View style={styles.lockIcon}>
            <Svg
              width={15}

              height={15}

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
            Your health information is private. Access is protected by secure
            authentication.
          </Text>
        </View>

        <View style={styles.footerBrand}>
          <LogoMark
            size={17}

            shieldColor="#0B3268"

            markColor="#FFFFFF"

            strokeColor="#0B3268"
          />

          <Text style={styles.footerBrandText}>
            WelliRecord
            <Text style={styles.footerTradeMark}>™</Text>
          </Text>
        </View>

        <Text style={styles.footerText}>
          One patient. One trusted record. Accessible when it matters.
        </Text>

        <View style={styles.bottomIndicator} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,

    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingHorizontal: 26,

    paddingTop: 10,

    paddingBottom: 16,
  },

  hero: {
    height: 150,

    backgroundColor: "#082F67",

    borderRadius: 15,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 18,
  },

  logoCard: {
    width: 84,

    height: 84,

    backgroundColor: "#FFFFFF",

    alignItems: "center",

    justifyContent: "center",
  },

  title: {
    color: "#082F67",

    fontSize: 36,

    lineHeight: 32,

    fontWeight: "800",

    letterSpacing: -0.45,

    marginBottom: 7,
  },

  tradeMark: {
    fontSize: 32,
  },

  subtitle: {
    color: "#183B68",

    fontSize: 16,

    fontWeight: "600",

    marginBottom: 16,
  },

  description: {
    color: "#425873",

    fontSize: 14,

    lineHeight: 19,

    maxWidth: 310,

    marginBottom: 18,
  },

  errorBox: {
    backgroundColor: "#FFF3F3",

    borderWidth: 1,

    borderColor: "#F0C4C4",

    borderRadius: 7,

    paddingHorizontal: 9,

    paddingVertical: 10,

    marginBottom: 10,
  },

  errorText: {
    color: "#A42C2C",

    fontSize: 12,
  },

  field: {
    marginBottom: 18,
  },

  fieldLabel: {
    color: "#173E6C",

    fontSize: 16,

    marginBottom: 5,
    fontWeight: "600",
  },

  passwordLabelRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },

  forgotText: {
    color: "#0B3268",

    fontSize: 14,

    fontWeight: "500",
  },

  input: {
    minHeight: 46,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: "#000000",

    paddingHorizontal: 8,

    paddingVertical: 10,

    color: "#161C26",

    fontSize: 14,
  },

  primaryButton: {
    minHeight: 48,

    borderRadius: 7,

    backgroundColor: "#082F67",

    alignItems: "center",

    justifyContent: "center",

    marginTop: 1,

    marginBottom: 14,
  },

  primaryButtonText: {
    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "500",
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  dividerRow: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 10,
  },

  dividerLine: {
    flex: 1,

    height: StyleSheet.hairlineWidth,

    backgroundColor: "#E2E6EC",
  },

  dividerText: {
    color: "#607083",

    fontSize: 12,

    marginHorizontal: 12,
  },

  phoneButton: {
    minHeight: 46,

    backgroundColor: "#F0F0F2",

    borderRadius: 20,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 14,
  },

  phoneButtonText: {
    color: "#303642",

    fontSize: 12,
  },

  createAccountRow: {
    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    marginBottom: 18,
  },

  createAccountText: {
    color: "#697789",

    fontSize: 12,
  },

  createAccountLink: {
    color: "#24558E",

    fontSize: 12,

    fontWeight: "500",
  },

  securityCard: {
    minHeight: 57,

    backgroundColor: "#EDF1F8",

    borderRadius: 10,

    flexDirection: "row",

    alignItems: "flex-start",

    paddingHorizontal: 10,

    paddingVertical: 10,

    marginBottom: 18,
  },

  lockIcon: {
    width: 21,

    paddingTop: 1,
  },

  securityText: {
    flex: 1,

    color: "#536A84",

    fontSize: 11.5,

    lineHeight: 16,
  },

  footerBrand: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 5,

    marginBottom: 8,
  },

  footerBrandText: {
    color: "#123B70",

    fontSize: 12,

    fontWeight: "700",
  },

  footerTradeMark: {
    fontSize: 7,
  },

  footerText: {
    color: "#42566F",

    fontSize: 10.5,

    lineHeight: 15,

    textAlign: "center",

    maxWidth: 180,

    alignSelf: "center",
  },

  bottomIndicator: {
    width: 93,

    height: 3,

    borderRadius: 2,

    backgroundColor: "#101820",

    alignSelf: "center",

    marginTop: 18,
  },
});
