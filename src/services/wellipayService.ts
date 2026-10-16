/**
 * WelliPay patient API client.
 *
 * WelliPay (the separate wellipay-api service) identifies a patient by a Clerk
 * session. The app trades a Clerk session token for a short-lived WelliPay
 * patient token (POST /patient/token), or links the account once with the
 * reference and amount printed on a bill (POST /patient/link).
 *
 * Payment state is only ever read from WelliPay. The app never marks a bill
 * as paid itself.
 */

export const WELLIPAY_API_URL = (process.env.EXPO_PUBLIC_WELLIPAY_API_URL || '').replace(/\/+$/, '');

export const isWellipayConfigured = WELLIPAY_API_URL.length > 0;

export class WellipayError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WellipayError';
    this.status = status;
    this.code = code;
  }
}

export interface WellipayInvoice {
  invoiceId: string;
  providerInvoiceRef: string;
  description: string;
  amountMinor: number;
  currency: string;
  paidAmountMinor: number;
  status: 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | string;
  dueAt?: string;
  createdAt: string;
}

export interface WellipayTransaction {
  transactionId: string;
  reference: string;
  invoiceId: string;
  providerName: string;
  invoiceRef: string;
  description: string;
  amountMinor: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  paidAt?: string;
  createdAt: string;
  failureReason?: string;
  refundStatus?: string;
  refundedMinor?: number;
}

export interface WellipayWalletEntry {
  entryId: string;
  kind: string;
  amountMinor: number;
  reference: string;
  createdAt: string;
}

export interface WellipayWallet {
  balanceMinor: number;
  currency: string;
  minTopUpMinor: number;
  maxTopUpMinor: number;
  providerName: string;
  entries: WellipayWalletEntry[];
}

export interface WellipayCard {
  methodId: string;
  brand: string;
  last4: string;
  expMonth?: string;
  expYear?: string;
  bank?: string;
  expired: boolean;
}

export interface WellipayCharge {
  reference: string;
  authorizationUrl: string;
  amountMinor: number;
  status: string;
}

export interface WellipayMoney {
  amountMinor: number;
  currency: string;
}

export interface WellipayHmoPolicy {
  hmoPolicyId: string;
  provider: string;
  policyNo: string;
  enrolleeName: string;
  planTier: string;
  coPayPercent: number;
  annualLimit: WellipayMoney;
  usedAmount: WellipayMoney;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | string;
  expiryDate?: string;
}

export interface WellipayPreAuth {
  preAuthId: string;
  hmoPolicyId: string;
  facilityRef: string;
  procedure: string;
  estimatedCost: WellipayMoney;
  coveredAmount: WellipayMoney;
  patientPortion: WellipayMoney;
  status: 'APPROVED' | 'IN_REVIEW' | 'DECLINED' | string;
  approvalCode?: string;
  notes?: string;
  requestedAt: string;
}

export interface WellipayFundingRequest {
  requestId: string;
  invoiceId: string;
  status: string;
  fundedAmountMinor: number;
  currency: string;
  expiresAt?: string;
  createdAt: string;
  contributions: { contributionId: string; sponsorRef: string; amountMinor: number; status: string }[];
}

export function newIdempotencyKey(): string {
  let key = '';
  for (let i = 0; i < 32; i++) key += Math.floor(Math.random() * 16).toString(16);
  return key;
}

type TokenState = { token: string; expiresAt: number } | null;
let patientToken: TokenState = null;

export function clearWellipaySession() {
  patientToken = null;
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { token?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  if (!isWellipayConfigured) {
    throw new WellipayError('WelliPay is not available in this version of the app.', 503, 'not_configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${WELLIPAY_API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 204) return undefined as T;

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new WellipayError(
        data?.detail || data?.message || data?.title || 'WelliPay request failed.',
        res.status,
        data?.code,
      );
    }

    return data as T;
  } catch (err) {
    if (err instanceof WellipayError) throw err;
    throw new WellipayError('Could not reach WelliPay. Check your connection and try again.', 0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

function remember(res: TokenResponse): string {
  patientToken = {
    token: res.access_token,
    expiresAt: Date.now() + Math.max(30, res.expires_in) * 1000,
  };
  return res.access_token;
}

export const wellipayService = {
  /**
   * Returns a valid WelliPay patient token, trading the Clerk session token
   * if needed. Throws WellipayError with code "not_linked" when this person
   * has not linked a bill yet.
   */
  async ensureToken(getClerkToken: () => Promise<string | null>): Promise<string> {
    if (patientToken && patientToken.expiresAt - Date.now() > 60_000) {
      return patientToken.token;
    }
    const clerkToken = await getClerkToken();
    if (!clerkToken) {
      throw new WellipayError('Sign in to WelliPay to continue.', 401, 'no_clerk_session');
    }
    return remember(await call<TokenResponse>('POST', '/patient/token', { token: clerkToken }));
  },

  async link(
    getClerkToken: () => Promise<string | null>,
    invoiceRef: string,
    amountMinor: number,
  ): Promise<string> {
    const clerkToken = await getClerkToken();
    if (!clerkToken) {
      throw new WellipayError('Sign in to WelliPay to continue.', 401, 'no_clerk_session');
    }
    return remember(
      await call<TokenResponse>('POST', '/patient/link', {
        token: clerkToken,
        body: { invoiceRef: invoiceRef.trim(), amountMinor },
      }),
    );
  },

  async listInvoices(token: string): Promise<WellipayInvoice[]> {
    const res = await call<{ items: WellipayInvoice[] }>('GET', '/patient/invoices?limit=50', { token });
    return res.items ?? [];
  },

  async listTransactions(token: string): Promise<WellipayTransaction[]> {
    const res = await call<{ items: WellipayTransaction[] }>('GET', '/patient/transactions?limit=50', { token });
    return res.items ?? [];
  },

  getTransaction(token: string, reference: string): Promise<WellipayTransaction> {
    return call<WellipayTransaction>('GET', `/patient/transactions/${encodeURIComponent(reference)}`, { token });
  },

  startCardCharge(
    token: string,
    body: { invoiceId: string; email?: string; amountMinor?: number },
  ): Promise<WellipayCharge> {
    return call<WellipayCharge>('POST', '/patient/paystack/charges', { token, body });
  },

  getWallet(token: string): Promise<WellipayWallet> {
    return call<WellipayWallet>('GET', '/patient/wallet', { token });
  },

  startTopUp(token: string, body: { amountMinor: number; email?: string }): Promise<WellipayCharge> {
    return call<WellipayCharge>('POST', '/patient/wallet/topups', { token, body });
  },

  getTopUp(token: string, reference: string): Promise<{ reference: string; status: string; failureReason?: string }> {
    return call('GET', `/patient/wallet/topups/${encodeURIComponent(reference)}`, { token });
  },

  payFromWallet(
    token: string,
    body: { invoiceId: string; amountMinor?: number },
  ): Promise<{ reference: string; amountMinor: number; invoiceStatus: string; balanceMinor: number }> {
    return call('POST', '/patient/wallet/pay', { token, body });
  },

  async listHmoPolicies(token: string): Promise<WellipayHmoPolicy[]> {
    const res = await call<{ items: WellipayHmoPolicy[] }>('GET', '/patient/hmo-policies?limit=50', { token });
    return res.items ?? [];
  },

  addHmoPolicy(
    token: string,
    body: {
      provider: string;
      policyNo: string;
      enrolleeName: string;
      planTier: string;
      coPayPercent: number;
      annualLimitMinor: number;
    },
    idempotencyKey: string,
  ): Promise<WellipayHmoPolicy> {
    return call<WellipayHmoPolicy>('POST', '/patient/hmo-policies', { token, body: { ...body, currency: 'NGN' }, idempotencyKey });
  },

  async listPreAuths(token: string): Promise<WellipayPreAuth[]> {
    const res = await call<{ items: WellipayPreAuth[] }>('GET', '/patient/pre-authorizations?limit=50', { token });
    return res.items ?? [];
  },

  createPreAuth(
    token: string,
    body: { hmoPolicyId: string; facilityRef: string; procedure: string; estimatedCostMinor: number },
    idempotencyKey: string,
  ): Promise<WellipayPreAuth> {
    return call<WellipayPreAuth>('POST', '/patient/pre-authorizations', { token, body, idempotencyKey });
  },

  async listFamilyFunding(token: string): Promise<WellipayFundingRequest[]> {
    const res = await call<{ items: WellipayFundingRequest[] }>('GET', '/patient/family-funding-requests?limit=50', { token });
    return res.items ?? [];
  },

  async listCards(token: string): Promise<WellipayCard[]> {
    const res = await call<{ items: WellipayCard[] }>('GET', '/patient/payment-methods', { token });
    return res.items ?? [];
  },

  removeCard(token: string, methodId: string): Promise<void> {
    return call<void>('DELETE', `/patient/payment-methods/${encodeURIComponent(methodId)}`, { token });
  },
};

export function formatMinor(amountMinor: number, currency = 'NGN'): string {
  const major = amountMinor / 100;
  const text = major.toLocaleString('en-NG', { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return currency === 'NGN' ? `₦${text}` : `${currency} ${text}`;
}
