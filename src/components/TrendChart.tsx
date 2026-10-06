import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

export interface TrendLine {
  color: string;
  points: { t: number; y: number }[];
}

interface Props {
  lines: TrendLine[];
  from: number;
  to: number;
  unit: string;
  width: number;
  height?: number;
  textColor: string;
  gridColor: string;
}

const PAD = { l: 36, r: 10, t: 10, b: 22 };

function fmtDay(t: number) {
  return new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function TrendChart({ lines, from, to, unit, width, height = 160, textColor, gridColor }: Props) {
  const all = lines.flatMap((l) => l.points.map((p) => p.y));
  if (all.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textColor, fontSize: 13 }}>No readings in this period</Text>
      </View>
    );
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;

  const w = width - PAD.l - PAD.r;
  const h = height - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + (to === from ? w / 2 : ((t - from) / (to - from)) * w);
  const y = (v: number) => PAD.t + h - ((v - min) / (max - min)) * h;
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];

  return (
    <Svg width={width} height={height} accessibilityLabel={`Trend chart in ${unit}`}>
      {ticks.map((v) => (
        <React.Fragment key={v}>
          <Line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke={gridColor} strokeWidth={1} />
          <SvgText x={PAD.l - 6} y={y(v) + 4} fontSize={10} fill={textColor} textAnchor="end">
            {Math.round(v * 10) / 10}
          </SvgText>
        </React.Fragment>
      ))}
      <SvgText x={PAD.l} y={height - 6} fontSize={10} fill={textColor} textAnchor="start">
        {fmtDay(from)}
      </SvgText>
      <SvgText x={width - PAD.r} y={height - 6} fontSize={10} fill={textColor} textAnchor="end">
        {fmtDay(to)}
      </SvgText>
      {lines.map((l, i) => {
        const pts = [...l.points].sort((a, b) => a.t - b.t);
        return (
          <React.Fragment key={i}>
            {pts.length > 1 && (
              <Polyline
                points={pts.map((p) => `${x(p.t)},${y(p.y)}`).join(' ')}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {pts.map((p, j) => (
              <Circle key={j} cx={x(p.t)} cy={y(p.y)} r={3.5} fill={l.color} />
            ))}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
