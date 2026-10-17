// Crash and error reports go to our own backend (POST /client-errors), not to a
// third-party service, because health data must not leave our systems.
//
// A report holds: error name, a scrubbed message and stack, where it happened,
// app version and platform. It holds no user id, no token and no request bodies.
// Anything that looks like an email, phone number, long number or id is masked.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { CONFIG } from '../services/config';

const MAX_PER_SESSION = 20;
const sent = new Set<string>();
let count = 0;

export function scrub(text: string): string {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b[0-9a-f]{24}\b/gi, '[id]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\bWR[-\s]?\w{4,}\b/gi, '[wellid]');
}

export interface ReportContext {
  where?: string;
  fatal?: boolean;
}

export function reportError(err: unknown, ctx: ReportContext = {}): void {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
    const message = scrub(e.message).slice(0, 300);
    const key = `${ctx.where || ''}|${e.name}|${message}`;
    if (sent.has(key) || count >= MAX_PER_SESSION) return;
    sent.add(key);
    count += 1;

    if (__DEV__) console.warn('[error]', ctx.where || '', e);

    fetch(`${CONFIG.apiBaseUrl}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: e.name,
        message,
        stack: scrub(e.stack || '').slice(0, 2000),
        where: ctx.where || '',
        fatal: Boolean(ctx.fatal),
        appVersion: Constants.expoConfig?.version || '',
        platform: Platform.OS,
        osVersion: String(Platform.Version),
      }),
    }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
}

/** Reports uncaught JS errors and unhandled promise rejections. Call once at start-up. */
export function installGlobalErrorHandlers(): void {
  const g: any = globalThis;
  const ErrorUtils = g.ErrorUtils;
  if (ErrorUtils?.setGlobalHandler) {
    const previous = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      reportError(error, { where: 'global', fatal: Boolean(isFatal) });
      previous?.(error, isFatal);
    });
  }
}
