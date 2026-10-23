// The legal documents shown before sign-up and in Profile. Ids and versions must match
// server/data/legalDocs.ts: the server refuses an acceptance that names an old version.
//
// The Terms and Conditions are a plain-language draft that has not had a legal review. Have a
// lawyer check them, change the text, then raise the version here and on the server.

export type LegalDocId = 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  version: string;
  required: boolean;
  /** The text of the checkbox. */
  agreeLabel: string;
  sections: LegalSection[];
}

/** Shown as "Effective date" on the acceptance screen. Confirm it before launch. */
export const LEGAL_EFFECTIVE_DATE = '23 October 2026';

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Information We Collect',
    body: 'WelliRecord stores the health records you or your care team add — lab results, prescriptions, imaging, and clinical notes — along with basic profile details like your name, date of birth, blood type, and emergency contact. If you connect a wearable, we also store the vitals it reports.',
  },
  {
    heading: 'How We Use Your Information',
    body: 'Your data is used solely to provide and improve the WelliRecord service for you and the family members on your account. We never sell your data, use it for advertising, or share it with third parties without your explicit permission.',
  },
  {
    heading: 'Your location',
    body: 'If you allow location, the lab and pharmacy locators send your position to our server, which asks Google Places for places near you. We do not store your position. If you do not allow it, the locators show Abuja.',
  },
  {
    heading: 'The Assistant',
    body: 'When you type a question to the Assistant, the conversation is sent to an AI service to write the answer. The Assistant cannot see your records or account, and we do not send them. Do not type personal health details, ID numbers, passwords or codes that you do not want processed. The Assistant gives general information and is not a doctor. In an emergency, call 112.',
  },
  {
    heading: 'Sharing and Smart Consent',
    body: 'When you share a record with a provider or facility, we generate a time-limited grant that you can revoke at any time. You choose exactly which categories or records are shared. For a provider without WelliRecord, your phone encrypts the shared copy before it is uploaded. The key is in the link and QR code and is not sent to us, so we store only the encrypted copy. Anyone with the full link and the one-time code can open it until it expires or you withdraw it.',
  },
  {
    heading: 'Security and Encryption',
    body: 'All records are encrypted at rest and in transit. Optional protections — Two-Factor Authentication and Face ID Lock — are available in Privacy & Security and Settings, and are off by default.',
  },
  {
    heading: 'Your Rights & Data Portability',
    body: 'You can download a full copy of your data at any time from Privacy & Security. You can delete your account yourself in Profile, Privacy & security, Delete account. Deletion is immediate. If you cannot open the app, email privacy@wellirecord.com.',
  },
  {
    heading: 'Contact Us',
    body: 'Questions about this policy or your data can be sent to privacy@wellirecord.com.',
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'About these terms',
    body: 'These terms cover your use of the WelliRecord mobile app, run by Wellinovate Limited in Abuja, Nigeria. By creating an account you agree to them and to the Privacy & Data Protection Policy.',
  },
  {
    heading: 'Your account',
    body: 'Give accurate details and keep your sign-in details and codes to yourself. You are responsible for what happens under your account. If you add a child or another family member, you confirm that you are entitled to manage their health information.',
  },
  {
    heading: 'Not medical advice',
    body: 'WelliRecord stores, organises and shares health records. It does not diagnose or treat anything. The Assistant gives general information only and is not a doctor. In an emergency, call 112.',
  },
  {
    heading: 'Your records and sharing',
    body: 'Your records stay under your control. You choose what to share, with whom and for how long, and you can withdraw access where the app supports it. Anything a person has already seen or saved before you withdraw it stays with them.',
  },
  {
    heading: 'What you must not do',
    body: 'Do not use WelliRecord for anything unlawful, look at or add records for someone without their permission, upload files you have no right to share, or try to break or bypass the security of the app or its servers.',
  },
  {
    heading: 'Doctors, hospitals, labs and pharmacies',
    body: 'Bookings, prescriptions, orders and payments are arrangements between you and the provider. WelliRecord passes your request on but does not provide the care, and services vary by provider and by place.',
  },
  {
    heading: 'Changes and availability',
    body: 'We may change or pause parts of the app. If these terms change in a way that matters, we will publish a new version and ask you to accept it.',
  },
  {
    heading: 'Ending your account',
    body: 'You can delete your account yourself in Profile, Privacy & security, Delete account. Deletion is immediate. We may suspend an account that breaks these terms.',
  },
  {
    heading: 'Contact us',
    body: 'Questions about these terms can be sent to privacy@wellirecord.com.',
  },
];

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy & Data Protection Policy',
    version: 'privacy-2026-08',
    required: true,
    agreeLabel: 'I have read and agree to the Privacy & Data Protection Policy.',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    id: 'terms',
    title: 'Terms and Conditions',
    version: 'terms-draft-1',
    required: true,
    agreeLabel: 'I have read and agree to the Terms and Conditions.',
    sections: TERMS_SECTIONS,
  },
};

/** Documents a new person must accept, in the order shown. */
export const REQUIRED_DOCS: LegalDoc[] = [LEGAL_DOCS.privacy, LEGAL_DOCS.terms].filter((d) => d.required);
