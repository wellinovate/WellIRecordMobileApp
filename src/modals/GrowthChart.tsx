import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import type { GrowthEntry } from '../services/childHealthService';
import { WHO_GROWTH_REVIEW } from '../data/whoGrowth';
import {
  BAND_TEXT, METRIC_LABEL, MAX_MONTHS, curves, placeMeasurement, sexKey,
  type ChartMetric, type GrowthPoint,
} from '../utils/growth';

const ACCENT = '#0f766e';
const W = 320;
const H = 220;
const PAD = { l: 34, r: 8, t: 10, b: 24 };
const METRICS: ChartMetric[] = ['weight', 'length', 'head'];

interface Props {
  entries: GrowthEntry[];
  gender: string;
  dob: string;
  gestationalAgeWeeks?: number | null;
}

const VALUE_KEY: Record<ChartMetric, 'weightKg' | 'lengthCm' | 'headCircumferenceCm'> = {
  weight: 'weightKg', length: 'lengthCm', head: 'headCircumferenceCm',
};

export function GrowthChart({ entries, gender, dob, gestationalAgeWeeks }: Props) {
  const theme = useTheme();
  const [metric, setMetric] = useState<ChartMetric>('weight');
  const sex = sexKey(gender);
  const [useCorrected, setUseCorrected] = useState(true);
  const preterm = gestationalAgeWeeks != null && gestationalAgeWeeks < 37;

  const points = useMemo(() => {
    const out: GrowthPoint[] = [];
    for (const e of entries) {
      const p = placeMeasurement(metric, gender, dob, e.measuredOn, e[VALUE_KEY[metric]], { gestationalAgeWeeks, correct: useCorrected });
      if (p) out.push(p);
    }
    return out.sort((a, b) => a.ageMonths - b.ageMonths);
  }, [entries, metric, gender, dob, gestationalAgeWeeks, useCorrected]);

  const lines = useMemo(() => (sex ? curves(metric, sex) : []), [metric, sex]);

  if (!sex) {
    return (
      <Text style={{ color: theme.muted, fontSize: 13 }}>
        Add the child's sex (Female or Male) and date of birth in Details to see growth charts.
      </Text>
    );
  }

  const ys = [...lines.flatMap((l) => l.points.map((p) => p.y)), ...points.map((p) => p.value)];
  const yMin = Math.floor(Math.min(...ys));
  const yMax = Math.ceil(Math.max(...ys));
  const sx = (m: number) => PAD.l + (m / MAX_MONTHS) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const latest = points[points.length - 1];
  const unit = METRIC_LABEL[metric].unit;

  return (
    <View style={{ gap: 10 }}>
      {WHO_GROWTH_REVIEW.reviewStatus !== 'reviewed' && (
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          The WHO tables are loaded as published. The wording on this screen is waiting for a clinician to check it.
        </Text>
      )}
      {preterm && (
        <TouchableOpacity
          onPress={() => setUseCorrected((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: useCorrected }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: ACCENT, backgroundColor: useCorrected ? ACCENT : 'transparent' }} />
          <Text style={{ color: theme.text, fontSize: 13, flex: 1 }}>
            Born at {gestationalAgeWeeks} weeks. Use corrected age until 2 years.
          </Text>
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {METRICS.map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMetric(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: metric === m }}
            style={{
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1,
              borderColor: metric === m ? ACCENT : theme.border,
              backgroundColor: metric === m ? ACCENT : 'transparent',
            }}
          >
            <Text style={{ color: metric === m ? '#fff' : theme.text, fontSize: 13 }}>{METRIC_LABEL[m].title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`${METRIC_LABEL[metric].title} for age chart`}>
        {[0, 12, 24, 36, 48, 60].map((m) => (
          <SvgText key={m} x={sx(m)} y={H - 8} fontSize="9" fill={theme.muted} textAnchor="middle">{m}</SvgText>
        ))}
        <SvgText x={W - PAD.r} y={H - 8} fontSize="9" fill={theme.muted} textAnchor="end">months</SvgText>
        {[yMin, Math.round((yMin + yMax) / 2), yMax].map((v) => (
          <SvgText key={v} x={PAD.l - 4} y={sy(v) + 3} fontSize="9" fill={theme.muted} textAnchor="end">{v}</SvgText>
        ))}
        <Line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={theme.border} strokeWidth={1} />
        <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke={theme.border} strokeWidth={1} />
        {lines.map((l) => (
          <Polyline
            key={l.z}
            points={l.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
            fill="none"
            stroke={l.z === 0 ? ACCENT : Math.abs(l.z) === 2 ? theme.muted : theme.border}
            strokeWidth={l.z === 0 ? 1.5 : 1}
            strokeDasharray={l.z === 0 ? undefined : Math.abs(l.z) === 3 ? '2,3' : '5,3'}
          />
        ))}
        {points.length > 1 && (
          <Polyline points={points.map((p) => `${sx(p.ageMonths)},${sy(p.value)}`).join(' ')} fill="none" stroke={theme.text} strokeWidth={1.5} />
        )}
        {points.map((p, i) => (
          <Circle key={i} cx={sx(p.ageMonths)} cy={sy(p.value)} r={3.5} fill={p.band === 'usual' ? theme.text : '#b45309'} />
        ))}
      </Svg>
      <Text style={{ color: theme.muted, fontSize: 11 }}>
        Solid line: median. Dashed lines: 2 and 3 standard deviations from the median. Source: WHO Child Growth Standards, birth to 5 years.
      </Text>
      {latest ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
            Latest {METRIC_LABEL[metric].title.toLowerCase()}: {latest.value} {unit}, about the {Math.round(latest.percentile)}th percentile
          </Text>
          <Text style={{ color: theme.text, fontSize: 13 }}>{BAND_TEXT[latest.band]}</Text>
          {latest.corrected && (
            <Text style={{ color: theme.muted, fontSize: 12 }}>
              Read at corrected age ({latest.ageMonths.toFixed(1)} months), counted from the due date because the baby was born early. Age from birth is {latest.chronologicalMonths.toFixed(1)} months.
            </Text>
          )}
        </View>
      ) : (
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          No {METRIC_LABEL[metric].title.toLowerCase()} measurements yet for a child aged 0 to 5 years.
        </Text>
      )}
    </View>
  );
}
