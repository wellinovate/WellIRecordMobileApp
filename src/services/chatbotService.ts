import { apiClient } from './apiClient';

export interface ChatOption {
  label: string;
  nextIntentKey: string;
}

export interface ChatResponse {
  message: string;
  options: ChatOption[];
  audience?: 'patient' | 'provider';
}

const DEFAULT_WELCOME: ChatResponse = {
  message: 'Hello! I am your WelliRecord Health Assistant. How can I help you manage your records today?',
  options: [
    { label: 'Share my medical records', nextIntentKey: 'share_records' },
    { label: 'Find a hospital or doctor', nextIntentKey: 'find_care' },
    { label: 'Prescription & pharmacy refill', nextIntentKey: 'refill_rx' },
    { label: 'Emergency ID & WelliBridge', nextIntentKey: 'emergency_id' },
  ],
  audience: 'patient',
};

const FALLBACK_INTENTS: Record<string, ChatResponse> = {
  share_records: {
    message:
      'With WelliRecord Smart Consent, you can share selected records with any hospital or clinic in Nigeria. Generate a 6-digit WelliBridge PIN or show a timed QR code. You control exactly what they can access and when access expires.',
    options: [
      { label: 'How does the PIN work?', nextIntentKey: 'bridge_pin' },
      { label: 'What is NDPR compliance?', nextIntentKey: 'ndpr_info' },
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  find_care: {
    message:
      'You can browse and locate verified Nigerian healthcare facilities, teaching hospitals, diagnostic labs, and 24/7 pharmacies right from the Care tab in your bottom navigation bar.',
    options: [
      { label: 'Book an appointment', nextIntentKey: 'book_visit' },
      { label: 'Find nearest pharmacy', nextIntentKey: 'find_pharmacy' },
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  refill_rx: {
    message:
      'You can request medication refills directly from your active prescriptions. Orders are verified with licensed e-pharmacy partners and delivered to your doorstep in major cities.',
    options: [
      { label: 'How to upload prescription', nextIntentKey: 'upload_rx' },
      { label: 'Delivery turnaround time', nextIntentKey: 'delivery_time' },
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  emergency_id: {
    message:
      'Your Emergency ID Card contains critical life-saving info: blood group, genotype, severe allergies, and primary emergency contacts. First responders can scan your QR code instantly without unlocking your phone.',
    options: [
      { label: 'Update my blood type / genotype', nextIntentKey: 'update_vitals' },
      { label: 'Add next of kin contact', nextIntentKey: 'add_contact' },
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  bridge_pin: {
    message:
      'A WelliBridge PIN is a single-use 6-digit code valid for a preset duration (e.g. 15 minutes or 1 hour). The healthcare provider enters it into the WelliRecord Provider Portal to view only the records you authorized.',
    options: [
      { label: 'Share records now', nextIntentKey: 'share_records' },
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  ndpr_info: {
    message:
      'WelliRecord is fully compliant with the Nigeria Data Protection Regulation (NDPR) and international healthcare privacy guidelines. Your medical records are encrypted end-to-end with AES-256 and only accessible with your explicit consent.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  book_visit: {
    message:
      'To book a consultation, navigate to the Care tab, select your preferred doctor or specialist clinic, and choose an in-person or virtual telehealth appointment slot.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  find_pharmacy: {
    message:
      'Open the Care tab and switch to "Pharmacies" to locate accredited retail pharmacies nearby, check medication stock, and order home delivery.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  upload_rx: {
    message:
      'Tap "Scan document" on your home screen or the "+" button in Records. Take a clear photo of your handwritten or printed doctor\'s prescription. Our AI OCR will automatically extract the medication details.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  delivery_time: {
    message:
      'Prescriptions approved before 2:00 PM are delivered same-day in Lagos, Abuja, and Port Harcourt. Standard delivery takes 24 hours nationwide.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  update_vitals: {
    message:
      'Tap on the Emergency ID card on your home screen to review and edit your clinical vitals, allergies, and blood group info.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  add_contact: {
    message:
      'Go to your Emergency ID or Family Access tab to designate emergency contacts and proxy caregivers who can be notified in crisis situations.',
    options: [
      { label: 'Back to main menu', nextIntentKey: 'start_over' },
    ],
    audience: 'patient',
  },
  start_over: DEFAULT_WELCOME,
};

export const chatbotService = {
  open: async (): Promise<ChatResponse> => {
    try {
      const res = await apiClient.post<any>('/chatbot/open');
      const data = res?.data || res;
      if (data && typeof data === 'object' && 'message' in data) {
        return data as ChatResponse;
      }
      return DEFAULT_WELCOME;
    } catch {
      return DEFAULT_WELCOME;
    }
  },

  respond: async (payload: { intentKey?: string; message?: string }): Promise<ChatResponse> => {
    try {
      const res = await apiClient.post<any>('/chatbot/respond', payload);
      const data = res?.data || res;
      if (data && typeof data === 'object' && 'message' in data) {
        return data as ChatResponse;
      }
      const key = payload.intentKey || 'start_over';
      return FALLBACK_INTENTS[key] || DEFAULT_WELCOME;
    } catch {
      const key = payload.intentKey || 'start_over';
      return FALLBACK_INTENTS[key] || DEFAULT_WELCOME;
    }
  },
};

export default chatbotService;
