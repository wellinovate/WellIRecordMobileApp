/**
 * Paystack split payments. A clinic or pharmacy can have a Paystack subaccount (ACCT_...).
 * When it does, Paystack settles the payment to that account's bank account instead of ours.
 *
 * Settings (environment):
 *   PAYSTACK_FEE_BEARER          'account' (default, we pay Paystack's fee) or 'subaccount'
 *   PLATFORM_FEE_PERCENT         our share of each payment, 0 to 50. Unset or 0: Paystack uses the
 *                                percentage set on the subaccount in the Paystack dashboard.
 *   PAYSTACK_REQUIRE_SUBACCOUNT  'true' turns online payment off for a provider without a subaccount
 */

export const SUBACCOUNT_RE = /^ACCT_[A-Za-z0-9]{6,40}$/;

export const isSubaccountCode = (v: unknown): v is string => typeof v === 'string' && SUBACCOUNT_RE.test(v.trim());

/** Returns a clean code, '' to clear it, or null when the input is not a valid code. */
export function cleanSubaccount(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return SUBACCOUNT_RE.test(s) ? s : null;
}

export interface SplitSettings {
  bearer?: string;
  platformFeePercent?: number | string;
  requireSubaccount?: boolean | string;
}

export function splitSettingsFromEnv(env: Record<string, string | undefined> = process.env): SplitSettings {
  return {
    bearer: env.PAYSTACK_FEE_BEARER,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    requireSubaccount: env.PAYSTACK_REQUIRE_SUBACCOUNT,
  };
}

const pct = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : 0;
};

export interface Split {
  subaccount: string;
  bearer: 'account' | 'subaccount';
  /** Flat amount in kobo that stays with us. Left out when no percentage is set. */
  transaction_charge?: number;
}

/** What to add to a Paystack initialize call. Nothing when the provider has no subaccount. */
export function splitFor(input: { subaccount?: unknown; amountMinor: number }, settings: SplitSettings = splitSettingsFromEnv()): Split | null {
  const code = String(input.subaccount ?? '').trim();
  if (!SUBACCOUNT_RE.test(code)) return null;
  const out: Split = { subaccount: code, bearer: settings.bearer === 'subaccount' ? 'subaccount' : 'account' };
  const p = pct(settings.platformFeePercent);
  if (p > 0 && Number.isFinite(input.amountMinor) && input.amountMinor > 0) {
    out.transaction_charge = Math.min(Math.round((input.amountMinor * p) / 100), Math.max(0, Math.round(input.amountMinor) - 1));
  }
  return out;
}

/** Online payment is offered unless subaccounts are required and this provider has none. */
export function onlineAllowed(subaccount: unknown, settings: SplitSettings = splitSettingsFromEnv()): boolean {
  const required = settings.requireSubaccount === true || String(settings.requireSubaccount ?? '').toLowerCase() === 'true';
  return !required || isSubaccountCode(subaccount);
}
