// Public contact details for WelliRecord. Shown on Help & support. Change them here only.
export const SUPPORT_EMAIL = 'info@wellirecord.com';

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  badge: string;
  color: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/careidhq', badge: 'IG', color: '#C13584' },
  { id: 'x', label: 'X', url: 'https://x.com/wellinovate', badge: 'X', color: '#111111' },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@wellirecord', badge: 'TT', color: '#111111' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@wellirecord', badge: 'YT', color: '#E02424' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/wellirecord/', badge: 'in', color: '#0A66C2' },
];
