import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const NAVY = '#041E42';
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Stroke lengths of the two chevrons in the 100 x 120 logo box.
const OUTER_LEN = 150;
const INNER_LEN = 84;

const MIN_MS = 2000;

/**
 * Full-screen opening animation for the WelliRecord mark: the shield settles in, the two chevrons
 * draw, the plus appears, a soft ring pulses and the name fades up. It covers the blank gap between
 * the native splash and the first screen. It stays until `ready` is true and the intro has played,
 * then fades out and calls `onFinish`.
 */
export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [shield] = useState(() => new Animated.Value(0));
  const [outer] = useState(() => new Animated.Value(0));
  const [inner] = useState(() => new Animated.Value(0));
  const [plus] = useState(() => new Animated.Value(0));
  const [name] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    const play = (reduce: boolean) => {
      if (reduce) {
        [shield, outer, inner, plus, name].forEach((v) => v.setValue(1));
        setTimeout(() => !cancelled && setIntroDone(true), 600);
        return;
      }
      const t = (v: Animated.Value, to: number, duration: number, delay = 0, native = false) =>
        Animated.timing(v, { toValue: to, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
      Animated.parallel([
        Animated.spring(shield, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        t(outer, 1, 650, 350),
        t(inner, 1, 450, 750),
        t(plus, 1, 250, 1100, true),
        t(name, 1, 500, 1250, true),
      ]).start();
      loop = Animated.loop(
        Animated.timing(ring, { toValue: 1, duration: 1400, delay: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      );
      loop.start();
      setTimeout(() => !cancelled && setIntroDone(true), MIN_MS);
    };

    AccessibilityInfo.isReduceMotionEnabled().then((r) => !cancelled && play(Boolean(r))).catch(() => !cancelled && play(false));
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [shield, outer, inner, plus, name, ring]);

  useEffect(() => {
    if (!ready || !introDone) return;
    Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onFinish());
  }, [ready, introDone, fade, onFinish]);

  const outerOffset = outer.interpolate({ inputRange: [0, 1], outputRange: [OUTER_LEN, 0] });
  const innerOffset = inner.interpolate({ inputRange: [0, 1], outputRange: [INNER_LEN, 0] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] });

  return (
    <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="auto" accessibilityLabel="WelliRecord is loading">
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.View style={{ opacity: shield, transform: [{ scale: shield.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
          <Svg width={120} height={144} viewBox="0 0 100 120" fill="none">
            <Path
              d="M50 4 C52 4, 86 11, 88 12.5 C90 14, 91 16, 91 22 L91 58 C91 82, 72 104, 50 116 C28 104, 9 82, 9 58 L9 22 C9 16, 10 14, 12 12.5 C14 11, 48 4, 50 4 Z"
              fill="#FFFFFF"
            />
            <AnimatedPath
              d="M15 98 L50 34 L85 98"
              stroke={NAVY}
              strokeWidth={8.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${OUTER_LEN} ${OUTER_LEN}`}
              strokeDashoffset={outerOffset as unknown as number}
            />
            <AnimatedPath
              d="M31 106 L50 71 L69 106"
              stroke={NAVY}
              strokeWidth={8.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${INNER_LEN} ${INNER_LEN}`}
              strokeDashoffset={innerOffset as unknown as number}
            />
          </Svg>
          <Animated.View style={[styles.plus, { opacity: plus, transform: [{ scale: plus.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
            <View style={styles.plusH} />
            <View style={styles.plusV} />
          </Animated.View>
        </Animated.View>
        <Animated.Text style={[styles.name, { opacity: name, transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          WelliRecord<Animated.Text style={styles.tm}>™</Animated.Text>
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: NAVY, zIndex: 9999, elevation: 9999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: '#FFFFFF', marginBottom: 56 },
  // Plus sits in the shield's top right, at (78, 30) of the 100 x 120 box scaled by 1.2.
  plus: { position: 'absolute', left: 78 * 1.2 - 8.4, top: 30 * 1.2 - 8.4, width: 16.8, height: 16.8, alignItems: 'center', justifyContent: 'center' },
  plusH: { position: 'absolute', width: 16.8, height: 4.5, backgroundColor: NAVY },
  plusV: { position: 'absolute', width: 4.5, height: 16.8, backgroundColor: NAVY },
  name: { marginTop: 28, color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.4 },
  tm: { fontSize: 10, fontWeight: '600' },
});
