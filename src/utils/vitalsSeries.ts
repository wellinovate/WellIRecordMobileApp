import type { VitalLogEntry } from '../data/types';

export interface VitalPoint {
  /** epoch ms */
  t: number;
  sys?: number;
  dia?: number;
  hr?: number;
  spo2?: number;
  temp?: number;
  glucose?: number;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/** Converts provider vitals documents (web `vitals` collection) to points. */
export function pointsFromProvider(items: any[]): VitalPoint[] {
  const out: VitalPoint[] = [];
  for (const v of items || []) {
    const t = new Date(v.measuredAt || v.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    const p: VitalPoint = {
      t,
      sys: num(v.bloodPressure?.systolic),
      dia: num(v.bloodPressure?.diastolic),
      hr: num(v.heartRate),
      spo2: num(v.oxygenSaturation),
      temp: num(v.temperature?.value),
    };
    if (Object.values(p).some((x, i) => i > 0 && x !== undefined)) out.push(p);
  }
  return out;
}

/** Converts locally logged vitals (Home screen entries) to points. */
export function pointsFromLogs(logs: VitalLogEntry[]): VitalPoint[] {
  const out: VitalPoint[] = [];
  for (const l of logs || []) {
    if (l.id.startsWith('srv_')) continue; // already covered by provider data
    const t = new Date(l.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (l.type === 'bp') {
      const [s, d] = String(l.primaryValue).split('/');
      const sys = num(s);
      const dia = num(d);
      if (sys !== undefined) out.push({ t, sys, dia });
    } else if (l.type === 'pulse') {
      const hr = num(l.primaryValue);
      if (hr !== undefined) out.push({ t, hr });
    } else if (l.type === 'glucose') {
      const glucose = num(l.primaryValue);
      if (glucose !== undefined) out.push({ t, glucose });
    }
  }
  return out;
}

/** Latest-reading cards for Home, derived from provider vitals (newest first). */
export function latestProviderLogs(items: any[]): VitalLogEntry[] {
  const pts = pointsFromProvider(items).sort((a, b) => b.t - a.t);
  const logs: VitalLogEntry[] = [];
  const bp = pts.find((p) => p.sys !== undefined && p.dia !== undefined);
  if (bp) {
    logs.push({
      id: 'srv_bp',
      ownerId: 'me',
      type: 'bp',
      timestamp: new Date(bp.t).toISOString(),
      primaryValue: `${bp.sys}/${bp.dia}`,
      unit: 'mmHg',
      tag: 'Provider',
      tagColor: '#0EA5E9',
    });
  }
  const hr = pts.find((p) => p.hr !== undefined);
  if (hr) {
    logs.push({
      id: 'srv_hr',
      ownerId: 'me',
      type: 'pulse',
      timestamp: new Date(hr.t).toISOString(),
      primaryValue: String(hr.hr),
      unit: 'bpm',
      tag: 'Provider',
      tagColor: '#0EA5E9',
    });
  }
  return logs;
}
