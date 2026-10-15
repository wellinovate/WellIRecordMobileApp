import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LogoMark } from '../../../components/Logo';

type Props = {
  firstName?: string;
  onEnterVault: () => void;
};

export function SuccessfulLoginScreen({
  firstName,
  onEnterVault,
}: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#082F67"
      />

      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />

          <Text style={styles.headerBrand}>
            WelliRecord
            <Text style={styles.tradeMark}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.main}>
          <View style={styles.logoCard}>
            <LogoMark
              size={76}
              shieldColor="#082F67"
              markColor="#FFFFFF"
              strokeColor="#082F67"
            />
          </View>

          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Svg
                width={32}
                height={32}
                viewBox="0 0 32 32"
                fill="none"
              >
                <Circle
                  cx={16}
                  cy={16}
                  r={14}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />

                <Path
                  d="M10.5 16.5L14.2 20L21.7 12"
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>

          <Text style={styles.title}>
            Welcome Back{firstName ? `, ${firstName}` : ''}!
          </Text>

          <Text style={styles.description}>
            You've signed in successfully. Your health records are ready
            whenever you need them.
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={onEnterVault}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Go to My Health Vault
            </Text>
          </TouchableOpacity>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Svg
                width={19}
                height={19}
                viewBox="0 0 24 24"
                fill="none"
              >
                <Path
                  d="M6 4V10C6 12.8 8.2 15 11 15C13.8 15 16 12.8 16 10V4"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />

                <Path
                  d="M6 4H4M16 4H18"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />

                <Path
                  d="M11 15V17C11 19.2 12.8 21 15 21C17.2 21 19 19.2 19 17V15"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />

                <Circle
                  cx={19}
                  cy={13}
                  r={2}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
              </Svg>
            </View>

            <Text style={styles.tipText}>
              <Text style={styles.tipTitle}>
                Medical Tip:{' '}
              </Text>
              Keep your medication list, allergies, and emergency contact
              information up to date.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <LogoMark
              size={25}
              shieldColor="#FFFFFF"
              markColor="#082F67"
              strokeColor="#FFFFFF"
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#082F67',
  },

  container: {
    flex: 1,
    paddingHorizontal: 17,
    paddingTop: 8,
    paddingBottom: 8,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },

  headerSpacer: {
    width: 34,
  },

  headerBrand: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  tradeMark: {
    fontSize: 6,
  },

  main: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 31,
  },

  logoCard: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  successCard: {
    width: '100%',
    height: 71,
    backgroundColor: '#244A7D',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  successCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4B6E9D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 9,
  },

  description: {
    color: '#D7E0EE',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 23,
  },

  primaryButton: {
    width: '100%',
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  primaryButtonText: {
    color: '#082F67',
    fontSize: 10.5,
    fontWeight: '700',
  },

  tipCard: {
    width: '100%',
    minHeight: 61,
    borderWidth: 1,
    borderColor: '#3F6698',
    backgroundColor: '#244A7D',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 11,
  },

  tipIcon: {
    width: 28,
    paddingTop: 1,
  },

  tipText: {
    flex: 1,
    color: '#D7E1EF',
    fontSize: 8,
    lineHeight: 11.5,
  },

  tipTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  footer: {
    alignItems: 'center',
  },

  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 9,
  },

  footerBrandText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  footerTradeMark: {
    fontSize: 5,
  },

  footerText: {
    color: '#BFCBDB',
    fontSize: 7.5,
    lineHeight: 11,
    textAlign: 'center',
    maxWidth: 215,
  },

  bottomIndicator: {
    width: 106,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A6B9D0',
    marginTop: 25,
  },
});