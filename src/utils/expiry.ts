import type { ShareExpiry } from '../data/types';

export const EXPIRY_LABEL_MAP: Record<ShareExpiry, string> = {
  '24h': '24 hours from now',
  '7d': '7 days from now',
  '30d': '30 days from now',
  custom: '90 days from now',
};

export const EXPIRY_SHORT_LABEL_MAP: Record<ShareExpiry, string> = {
  '24h': 'in 24 hours',
  '7d': 'in 7 days',
  '30d': 'in 30 days',
  custom: 'in 90 days',
};
