import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '../../../components/Logo';

const NAVY = '#012353';
const TEAL = '#0F766E';

/** First screen for a new install. Get Started and Log In go to the existing flows. */
export function WelcomeScreen({
  onGetStarted,
  onLogIn,
  onTour,
}: {
  onGetStarted: () => void;
  onLogIn: () => void;
  onTour: () => void;
}) {
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <LogoMark size={64} shieldColor={NAVY} />
          <Text style={s.wordmark} accessibilityRole="header">
            WelliRecord<Text style={s.tm}>™</Text>
          </Text>
        </View>

        <Text style={s.title} accessibilityRole="header">Welcome to WelliRecord</Text>
        <Text style={s.tagline}>One patient. One trusted record. Accessible when it matters.</Text>
        <Text style={s.support}>
          Keep your health information organised, manage access to your records, and connect with supported healthcare services.
        </Text>

        <TouchableOpacity accessibilityRole="button" onPress={onGetStarted} style={s.primary}>
          <Text style={s.primaryText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onLogIn} style={s.secondary}>
          <Text style={s.secondaryText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onTour} style={s.tour}>
          <Text style={s.tourText}>Take a tour</Text>
        </TouchableOpacity>

        <Text style={s.foot}>Your health information. Your permission. Your choice.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  wordmark: { marginTop: 10, color: NAVY, fontSize: 22, fontWeight: '800' },
  tm: { fontSize: 9, fontWeight: '600' },
  title: { color: NAVY, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  tagline: { marginTop: 10, color: TEAL, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  support: { marginTop: 14, color: '#475569', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primary: { marginTop: 32, minHeight: 54, borderRadius: 14, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  secondary: { marginTop: 12, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: NAVY, fontSize: 17, fontWeight: '800' },
  tour: { marginTop: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  tourText: { color: TEAL, fontSize: 15, fontWeight: '700' },
  foot: { marginTop: 20, color: '#64748B', fontSize: 12.5, textAlign: 'center' },
});
