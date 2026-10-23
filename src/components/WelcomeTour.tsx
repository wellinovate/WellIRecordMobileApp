import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

const NAVY = '#012353';
const TEAL = '#0F766E';
const TINT = '#E8F1F0';

type Kind = 'vault' | 'share' | 'emergency' | 'services' | 'id';

// Copy describes what the app does today. Nothing here is patient data.
const TOUR_SLIDES: { kind: Kind; title: string; body: string }[] = [
  {
    kind: 'vault',
    title: 'Your health records, organised in one place',
    body: 'Keep your available medical reports, laboratory results, medications and health information together in your WelliRecord Health Vault.',
  },
  {
    kind: 'share',
    title: 'Share your records with permission',
    body: 'Give participating healthcare professionals access to selected records when needed. You control permissions and can revoke access where supported.',
  },
  {
    kind: 'emergency',
    title: 'Be prepared for emergencies',
    body: 'Make important health information easier to access in an emergency through supported emergency-access features and QR functionality.',
  },
  {
    kind: 'services',
    title: 'Connect to healthcare services',
    body: 'Discover supported doctors, hospitals, diagnostic centres and pharmacies, and access available booking and service features.',
  },
  {
    kind: 'id',
    title: 'Your WelliRecord. Your WR-ID. Your control.',
    body: 'Get your WelliRecord ID, access supported services and manage your health information from your account.',
  },
];

function Art({ kind }: { kind: Kind }) {
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={110} cy={85} r={78} fill={TINT} />
      {kind === 'vault' && (
        <G>
          <Rect x={62} y={50} width={72} height={86} rx={9} fill="#FFFFFF" stroke={NAVY} strokeWidth={3} />
          <Rect x={78} y={36} width={72} height={86} rx={9} fill="#FFFFFF" stroke={TEAL} strokeWidth={3} />
          <Path d="M92 62h44M92 78h44M92 94h28" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
          <Path d="M148 96c0 18-12 30-24 36-12-6-24-18-24-36l24-9 24 9Z" fill={NAVY} />
          <Path d="M115 108l7 7 12-14" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {kind === 'share' && (
        <G>
          <Rect x={30} y={62} width={54} height={66} rx={8} fill="#FFFFFF" stroke={NAVY} strokeWidth={3} />
          <Path d="M42 82h30M42 96h30M42 110h18" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
          <Path d="M92 95h36" stroke={TEAL} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 9" />
          <Rect x={104} y={79} width={24} height={30} rx={6} fill={TEAL} />
          <Path d="M110 79v-6a6 6 0 0 1 12 0v6" stroke={TEAL} strokeWidth={4} fill="none" />
          <Circle cx={166} cy={82} r={15} fill={NAVY} />
          <Path d="M140 130c0-14 12-22 26-22s26 8 26 22" fill={NAVY} />
          <Circle cx={184} cy={66} r={11} fill={TEAL} />
          <Path d="M179 66l4 4 7-8" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {kind === 'emergency' && (
        <G>
          <Circle cx={110} cy={70} r={34} fill={NAVY} />
          <Path d="M110 52v36M92 70h36" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" />
          <Rect x={76} y={112} width={68} height={40} rx={8} fill="#FFFFFF" stroke={TEAL} strokeWidth={3} />
          <Rect x={86} y={120} width={10} height={10} fill={NAVY} />
          <Rect x={100} y={120} width={10} height={10} fill={NAVY} />
          <Rect x={124} y={120} width={10} height={10} fill={NAVY} />
          <Rect x={86} y={134} width={10} height={10} fill={NAVY} />
          <Rect x={110} y={134} width={10} height={10} fill={TEAL} />
          <Rect x={124} y={134} width={10} height={10} fill={NAVY} />
        </G>
      )}
      {kind === 'services' && (
        <G>
          <Rect x={44} y={74} width={58} height={62} rx={6} fill="#FFFFFF" stroke={NAVY} strokeWidth={3} />
          <Path d="M73 86v22M62 97h22" stroke={TEAL} strokeWidth={5} strokeLinecap="round" />
          <Rect x={66} y={118} width={14} height={18} fill={NAVY} />
          <Path d="M158 36c-16 0-28 12-28 28 0 22 28 50 28 50s28-28 28-50c0-16-12-28-28-28Z" fill={NAVY} />
          <Circle cx={158} cy={64} r={11} fill="#FFFFFF" />
          <Path d="M104 124c14-6 22-14 30-26" stroke={TEAL} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 9" />
        </G>
      )}
      {kind === 'id' && (
        <G>
          <Rect x={42} y={52} width={136} height={84} rx={12} fill={NAVY} />
          <Circle cx={74} cy={82} r={13} fill="#FFFFFF" opacity={0.9} />
          <Path d="M54 120c0-11 9-18 20-18s20 7 20 18" fill="#FFFFFF" opacity={0.9} />
          <Path d="M112 76h50M112 92h36" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
          <Rect x={112} y={106} width={50} height={18} rx={9} fill={TEAL} />
          <Path d="M122 115h30" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
        </G>
      )}
    </Svg>
  );
}

/**
 * Five swipeable slides with Back, Next and Skip. The last slide's main button is `finalLabel`.
 * No account data is shown. Used before sign-in and, from Profile, after it.
 */
export function WelcomeTour({
  onSkip,
  onFinish,
  onLogin,
  finalLabel = 'Get Started',
}: {
  onSkip: () => void;
  onFinish: () => void;
  onLogin?: () => void;
  finalLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const last = index === TOUR_SLIDES.length - 1;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(TOUR_SLIDES.length - 1, to));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: !reduceMotion });
  };

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.top}>
        <Text style={s.counter} accessibilityLiveRegion="polite">{`${index + 1} of ${TOUR_SLIDES.length}`}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip tour" onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.skip}>Skip tour</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
        style={s.pager}
      >
        {TOUR_SLIDES.map((slide, i) => (
          <View key={slide.kind} style={[s.slide, { width }]} accessible accessibilityLabel={`Slide ${i + 1} of ${TOUR_SLIDES.length}. ${slide.title}. ${slide.body}`}>
            <Art kind={slide.kind} />
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {TOUR_SLIDES.map((slide, i) => (
          <View key={slide.kind} style={[s.dot, i === index && s.dotOn]} />
        ))}
      </View>

      <View style={s.nav}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={index === 0}
          onPress={() => go(index - 1)}
          style={[s.back, index === 0 && { opacity: 0 }]}
        >
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => (last ? onFinish() : go(index + 1))}
          style={s.next}
        >
          <Text style={s.nextText}>{last ? finalLabel : 'Next'}</Text>
        </TouchableOpacity>
      </View>

      {last && onLogin ? (
        <TouchableOpacity accessibilityRole="button" onPress={onLogin} style={s.loginLink}>
          <Text style={s.loginText}>I already have an account. Log in</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.loginLink} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  counter: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  skip: { color: NAVY, fontSize: 14, fontWeight: '700' },
  pager: { flex: 1 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { marginTop: 24, color: NAVY, fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  body: { marginTop: 12, color: '#475569', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotOn: { width: 24, backgroundColor: TEAL },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, gap: 12 },
  back: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' },
  backText: { color: NAVY, fontSize: 15, fontWeight: '700' },
  next: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  loginLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  loginText: { color: TEAL, fontSize: 14, fontWeight: '700' },
});
