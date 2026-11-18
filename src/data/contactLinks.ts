// Public contact details for WelliRecord. Shown on Help & support. Change them here only.
export const SUPPORT_EMAIL = 'support@wellirecord.com';

export const SUPPORT_PHONE = '+2348053355504';
export const SUPPORT_PHONE_LABEL = '+234 805 335 5504';
export const WHATSAPP_URL = 'https://wa.me/2348053355504';

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  badge: string;
  color: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'whatsapp', label: 'WhatsApp', url: WHATSAPP_URL, badge: 'WA', color: '#25D366' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/mywellirecord', badge: 'IG', color: '#C13584' },
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61596458829642', badge: 'f', color: '#1877F2' },
  { id: 'x', label: 'X', url: 'https://x.com/wellinovate', badge: 'X', color: '#111111' },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@wellirecord', badge: 'TT', color: '#111111' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@wellirecord', badge: 'YT', color: '#E02424' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/wellirecord/', badge: 'in', color: '#0A66C2' },
];
