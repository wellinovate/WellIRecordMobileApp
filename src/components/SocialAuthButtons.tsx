import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useSSO } from '@clerk/expo';
import { hapticFeedback } from '../utils/haptics';

interface SocialAuthButtonsProps {
  onSuccess?: (details: { provider: 'google' | 'apple'; sessionId: string }) => void;
  onError?: (errMessage: string) => void;
  labelPrefix?: 'Continue with' | 'Sign in with' | 'Sign up with';
  showDivider?: boolean;
  dividerText?: string;
  compact?: boolean;
}

export function SocialAuthButtons({
  onSuccess,
  onError,
  labelPrefix = 'Continue with',
  showDivider = true,
  dividerText = 'or continue with',
  compact = false,
}: SocialAuthButtonsProps) {
  const { startSSOFlow } = useSSO();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const handleOAuth = async (strategy: 'oauth_google' | 'oauth_apple') => {
    const provider = strategy === 'oauth_google' ? 'google' : 'apple';
    hapticFeedback.selection();
    setLoadingProvider(provider);

    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        hapticFeedback.success();
        onSuccess?.({ provider, sessionId: createdSessionId });
      } else if (signUp?.status === 'missing_requirements') {
        // Missing optional fields, handled gracefully
        onSuccess?.({ provider, sessionId: 'pending_clerk' });
      }
      // If user cancelled, createdSessionId is null without exception
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Authentication was interrupted';
      if (!msg.toLowerCase().includes('cancel')) {
        console.error(`[Clerk SSO Error (${provider})]`, err);
        onError?.(msg);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      {showDivider && (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{dividerText}</Text>
          <View style={styles.dividerLine} />
        </View>
      )}

      <View style={[styles.buttonsStack, compact && styles.buttonsRow]}>
        {/* Google Authentication Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOAuth('oauth_google')}
          disabled={loadingProvider !== null}
          style={[
            styles.socialBtn,
            styles.googleBtn,
            compact && styles.compactBtn,
            loadingProvider === 'google' && styles.btnLoading,
          ]}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color="#041E42" />
          ) : (
            <>
              <GoogleIcon size={20} />
              <Text style={styles.googleBtnText}>
                {compact ? 'Google' : `${labelPrefix} Google`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple Authentication Button (Always visible for universal consistency & App Store compliance) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOAuth('oauth_apple')}
          disabled={loadingProvider !== null}
          style={[
            styles.socialBtn,
            styles.appleBtn,
            compact && styles.compactBtn,
            loadingProvider === 'apple' && styles.btnLoading,
          ]}
        >
          {loadingProvider === 'apple' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <AppleIcon size={20} color="#ffffff" />
              <Text style={styles.appleBtnText}>
                {compact ? 'Apple' : `${labelPrefix} Apple`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G>
        <Path
          fill="#EA4335"
          d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
        />
        <Path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
        />
        <Path
          fill="#FBBC05"
          d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-3.1z"
        />
        <Path
          fill="#34A853"
          d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"
        />
      </G>
    </Svg>
  );
}

function AppleIcon({ size = 20, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 170 170">
      <Path
        fill={color}
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.64-7.83-11.83-14.37-6.08-9.46-10.74-20.08-13.98-31.85-3.24-11.78-4.86-22.95-4.86-33.51 0-14.28 3.51-26.01 10.53-35.18 7.02-9.18 15.75-13.88 26.19-14.11 4.7 0 9.77 1.24 15.21 3.71 5.43 2.48 9.38 3.77 11.83 3.89 2.01-.12 6.13-1.47 12.37-4.06 6.23-2.58 11.29-3.71 15.17-3.39 12.01.81 21.44 5.25 28.3 13.32-10.49 6.34-15.63 15.13-15.42 26.37.21 8.84 3.55 16.29 10.02 22.35 6.47 6.06 14.19 9.53 23.16 10.42-2.13 6.33-4.59 12.39-7.38 18.17zM119.22 33.15c0-6.19 2.23-12.08 6.69-17.67 4.46-5.59 9.87-9.33 16.23-11.22.42 1.37.64 2.75.64 4.13 0 6.08-2.34 11.96-7.02 17.64-4.68 5.68-10.23 9.4-16.65 11.16-.21-1.37-.32-2.72-.32-4.04z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonsStack: {
    gap: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
  },
  compactBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  appleBtn: {
    backgroundColor: '#041E42',
    shadowColor: '#041E42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  appleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnLoading: {
    opacity: 0.75,
  },
});
