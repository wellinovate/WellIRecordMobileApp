// The legal documents shown before sign-up and in Profile. Ids and versions must match
// server/data/legalDocs.ts: the server refuses an acceptance that names an old version.
//
// The Privacy Policy and the Terms and Conditions are plain-language drafts that have not had a
// legal review. Have a lawyer check them, change the text, then raise the version here and on
// the server. The fuller drafts with open questions are in the "WelliRecord legal drafts" document.

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
    heading: 'Who we are',
    body: 'WelliRecord is run by Wellinovate Limited (RC 8749732), Abuja, Nigeria. This policy says what health and other personal information the app handles, why, who can receive it, how long we keep it, and the choices you have. It is not consent to treatment or to a medical visit. Those need their own consent.',
  },
  {
    heading: 'Information we collect',
    body: 'Account: your name, date of birth, phone number, email address, state of residence, and the codes used to sign in or unlock the app.\n\nHealth information: records, allergies, conditions, medicines, vaccines, photos, PDFs and other files that you or a provider add, and measurements, medicines and family history that you type in.\n\nBookings and orders: the provider or pharmacy you choose, visit type, time, the reason you give, prescription photos, delivery address, and payment status.\n\nSecurity: sign-ins, shares, emergency scans and similar events. The last part of an IP address is hidden.\n\nWe collect only what a feature needs. Optional fields are marked as optional.',
  },
  {
    heading: 'How we use it',
    body: 'We use it to run your account and record, let you share what you choose, book visits, order medicines, send confirmations and reminders, run video visits, protect accounts and prevent fraud, meet legal duties, and keep the service working.\n\nWe do not sell your data and we do not use it for advertising. We do not share it with anyone else without your permission, except the service providers listed below and where the law requires.',
  },
  {
    heading: 'Who else receives it',
    body: 'We use service providers for specific jobs. Each receives only what its job needs.\n\n• Clerk: sign-in.\n• Termii: SMS and WhatsApp messages.\n• Resend: email.\n• Paystack: online payments.\n• LiveKit: video visits.\n• Google: nearby places on the map, and the Assistant.\n• Render and MongoDB Atlas: hosting and our database.\n• Cloudflare: storage of provider documents.\n\nRecord files and prescription files are not sent to any outside service to be processed. Some of the providers above process data outside Nigeria.',
  },
  {
    heading: 'Your location',
    body: 'If you allow location, the lab and pharmacy locators send your position to our server, which asks Google Places for places near you. We do not store your position. If you do not allow it, the locators show Abuja.',
  },
  {
    heading: 'The Assistant',
    body: 'When you type a question to the Assistant, up to your last 20 messages are sent to an AI service to write the answer. The Assistant cannot see your records or account, and we do not send them. We do not store the conversation. Do not type personal health details, ID numbers, passwords or codes that you do not want processed. The Assistant gives general information and is not a doctor. If your message mentions an emergency, it first tells you to call 112.',
  },
  {
    heading: 'Sharing with providers',
    body: 'Nothing is shared with a provider unless you choose it or the law requires it.\n\nFor a provider on WelliRecord, you choose the provider, the information and how long access lasts. You can withdraw it at any time.\n\nFor a provider without WelliRecord, your phone encrypts a copy of the sections you choose before it is uploaded. The key is in the link and QR code and is not sent to us, so we store only the encrypted copy. The link lasts from 1 hour to 7 days (24 hours by default). The provider needs a six-digit code to open it. Each time it is opened, we tell you. When you withdraw the link, the encrypted copy is deleted. Anyone with the full link and the code can open it until it expires or you withdraw it.\n\nWhen you stop access, we turn off future access. We cannot take back a copy that someone has already saved or printed. If you send a summary or an exported record through your phone, we no longer control that copy.',
  },
  {
    heading: 'Children and guardians',
    body: 'A child\'s profile belongs to a primary guardian. Other adults can be added with a one-time invite code, each with only the permissions the primary guardian sets. A custody restriction overrides those permissions. The app cannot check a court order. Views and changes to a child\'s record are written to an access log that primary guardians can read. A child can be invited to their own account from age 13 with view access. Records move to the child\'s own account only from age 18.',
  },
  {
    heading: 'Emergency information',
    body: 'For a child, the QR code holds the WelliID only. Emergency scans are logged. WelliRecord is not an emergency service. A QR code does not guarantee that anyone will scan it, read it or act on it. In an emergency, call 112.',
  },
  {
    heading: 'Messages and reminders',
    body: 'App notices are on by default. SMS and WhatsApp reminders are off until you turn them on, and we record the time you did. Reminders are sent between 8 am and 8 pm Lagos time. They carry the child\'s name and a dose count, not vaccine names. After you book a visit, we send you a confirmation by app notice, and by email and SMS if your account has them. These messages never show your reason for the visit.',
  },
  {
    heading: 'Security',
    body: 'Connections to our servers use HTTPS. Record files are encrypted before they are stored. The app locks after five minutes without a touch and when you reopen it. You unlock with your phone\'s biometrics or passcode, or with a code sent to your account\'s email or phone. You can turn on a second sign-in step with an authenticator app in Privacy & Security. The account log shows sign-ins, shares and emergency scans. No system is completely secure. Protect your phone and passwords, and tell us quickly if someone else may have used your account.',
  },
  {
    heading: 'How long we keep it',
    body: '• Sign-in and unlock codes: 5 minutes.\n• Prescription files for a pharmacy order: 30 days after the order ends.\n• A file uploaded but never attached to an order or record: 1 day.\n• Record files: until you delete the record or your account.\n• Encrypted copy for a provider link: until you withdraw it or it expires, then deleted within the hour. The link history stays 30 days.\n• Account log: 2 years.\n• Reminder records: 1 year.\n• Your position for nearby search: not stored.\n\nWe keep other account, booking and payment records only as long as we need them for the service or the law requires. A hospital, laboratory or pharmacy keeps its own records under its own duties.',
  },
  {
    heading: 'Your rights and deleting your account',
    body: 'You can see your information, correct it, share it, stop sharing it, and download a copy from Privacy & Security. You can delete your account yourself in Profile, Privacy & security, Delete account. Deletion happens straight away and cannot be undone. It removes your account and the health data we hold for it, including family members and children you added. Backups are overwritten on the host\'s normal cycle. Records held by a hospital, clinic, laboratory or pharmacy are not deleted.\n\nUnder the Nigeria Data Protection Act 2023 you can also object to or restrict processing and make a complaint. Some rights are limited by law, by other people\'s rights and by professional duties. If you cannot open the app, email privacy@wellirecord.com.',
  },
  {
    heading: 'When we may share without your consent',
    body: 'We may share information where the law requires it, where a court or competent authority issues a valid order or request, or where a legal exception applies, such as a public-health duty. We share only what that law or order covers. Where the law allows, we tell you.',
  },
  {
    heading: 'Complaints and contact',
    body: 'Send data protection requests and questions about this policy to privacy@wellirecord.com with the subject "WelliRecord Data Protection Request", or call +234 805 335 5504. If we refuse a request, we say why. You can also complain to the Nigeria Data Protection Commission.',
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'About these terms',
    body: 'These terms cover your use of the WelliRecord mobile app, run by Wellinovate Limited (RC 8749732) in Abuja, Nigeria. By creating an account you agree to them and to the Privacy & Data Protection Policy.',
  },
  {
    heading: 'Your account',
    body: 'Give accurate details and keep your sign-in details and codes to yourself. You are responsible for what happens under your account. If you add a child or another family member, you confirm that you are entitled to manage their health information. Do not pretend to be someone else.',
  },
  {
    heading: 'Not medical advice',
    body: 'WelliRecord stores, organises and shares health records. It does not diagnose, prescribe or treat anything. The Assistant gives general information only and is not a doctor. WelliRecord is not an emergency service. In an emergency, call 112 or go to the nearest hospital.',
  },
  {
    heading: 'Your records and sharing',
    body: 'Your records stay under your control. You choose what to share, with whom and for how long, and you can withdraw access where the app supports it. Anything a person has already seen or saved before you withdraw it stays with them.',
  },
  {
    heading: 'What you must not do',
    body: 'Do not use WelliRecord for anything unlawful, look at or add records for someone without their permission, upload files you have no right to share, upload an altered, forged or expired prescription, or try to break or bypass the security of the app or its servers.',
  },
  {
    heading: 'Doctors, hospitals, labs and pharmacies',
    body: 'Bookings, prescriptions, orders and payments are arrangements between you and the provider. WelliRecord passes your request on but does not provide the care or supply the medicine. Each provider is responsible for its licences, its staff, its decisions, its records and its prices. Services vary by provider and by place.\n\nA provider that the app marks as a WelliRecord provider has been set up with us. Other facilities that appear on a map are not checked by us. For them, the app saves a request that you send yourself. We do not notify the facility.\n\nA pharmacist decides whether a medicine can be supplied. The app is not set up for controlled, narcotic or psychotropic medicines. A pharmacy delivers with its own rider. WelliRecord does not deliver.\n\nThe booking and pharmacy screens show the rules for that visit or order before you pay.',
  },
  {
    heading: 'Payments and refunds',
    body: 'Online payments are made through Paystack, whose terms apply. A booking or order that you pay for online goes ahead only after the payment is confirmed. If a paid booking or order is cancelled or cannot be supplied, we mark it refund due. A person pays the refund. Refunds are not paid automatically. Nothing here removes a right you have under Nigerian consumer law.',
  },
  {
    heading: 'Messages',
    body: 'We send you notices about your account, bookings and orders in the app, and by email or SMS where we have your details. Reminders by SMS or WhatsApp are sent only if you turn them on.',
  },
  {
    heading: 'Changes and availability',
    body: 'We may change or pause parts of the app. The app, a provider\'s systems, power, networks or Paystack may fail, and we do not promise the app will always be available. If these terms change in a way that matters, we will publish a new version and ask you to accept it. Each version has a number and an effective date.',
  },
  {
    heading: 'Ending your account',
    body: 'You can delete your account yourself in Profile, Privacy & security, Delete account. Deletion happens straight away and cannot be undone. We may suspend an account that breaks these terms, and we tell you why where the law allows.',
  },
  {
    heading: 'Responsibility',
    body: 'Each of us is responsible for our own acts and legal duties. Nothing in these terms removes a right you have under Nigerian law, or limits liability that the law does not allow to be limited.',
  },
  {
    heading: 'Governing law and complaints',
    body: 'Nigerian law governs these terms. A court or other body with jurisdiction settles disputes. Nothing here removes your access to a regulator or a court.',
  },
  {
    heading: 'Contact us',
    body: 'Questions about these terms or a complaint can be sent to support@wellirecord.com or +234 805 335 5504. Data protection requests go to privacy@wellirecord.com.',
  },
];

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy & Data Protection Policy',
    version: 'privacy-2026-10',
    required: true,
    agreeLabel: 'I have read and agree to the Privacy & Data Protection Policy.',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    id: 'terms',
    title: 'Terms and Conditions',
    version: 'terms-draft-2',
    required: true,
    agreeLabel: 'I have read and agree to the Terms and Conditions.',
    sections: TERMS_SECTIONS,
  },
};

/** Documents a new person must accept, in the order shown. */
export const REQUIRED_DOCS: LegalDoc[] = [LEGAL_DOCS.privacy, LEGAL_DOCS.terms].filter((d) => d.required);
