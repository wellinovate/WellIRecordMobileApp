// Run once: npm run migrate:chatbot:provider
// Adds provider-facing intents alongside the existing patient ones — same
// ChatIntent collection, filtered by audience.

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { ChatIntent } from '../models';

const intents: Array<{
  intentKey: string;
  audience: 'patient' | 'provider';
  message: string;
  options: { label: string; nextIntentKey: string }[];
  isRoot?: boolean;
}> = [
  {
    intentKey: 'provider_start_over',
    audience: 'provider',
    isRoot: true,
    message: 'How can I help with your WelliRecord workflow today?',
    options: [
      { label: 'Look up a patient record', nextIntentKey: 'provider_patient_lookup' },
      { label: 'Check appointment status', nextIntentKey: 'provider_appointment_status' },
      { label: 'Check a billing record', nextIntentKey: 'provider_billing_lookup' },
      { label: 'Enter or view lab results', nextIntentKey: 'provider_lab_results' },
      { label: 'How does patient record access work?', nextIntentKey: 'provider_record_access_info' },
      { label: 'Talk to a human', nextIntentKey: 'provider_talk_to_human' },
    ],
  },
  {
    intentKey: 'provider_patient_lookup',
    audience: 'provider',
    message:
      'Search for a patient by phone number or patient ID in the Patients tab. If they already have a WelliRecord account, their existing record will be pulled up instead of starting a new one.',
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
  {
    intentKey: 'provider_appointment_status',
    audience: 'provider',
    message: 'Checking appointment status for this patient...',
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
  {
    intentKey: 'provider_billing_lookup',
    audience: 'provider',
    message: 'Checking billing record for this patient...',
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
  {
    intentKey: 'provider_lab_results',
    audience: 'provider',
    message:
      "Lab results are entered from the Lab tab against the patient's existing record. Critical results trigger an automatic SMS alert to the patient.",
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
  {
    intentKey: 'provider_record_access_info',
    audience: 'provider',
    message:
      'This answer is not finalized yet — the exact patient consent/access flow for a first-time visit is still being confirmed. Please check with your facility admin for now.',
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
  {
    intentKey: 'provider_talk_to_human',
    audience: 'provider',
    message: 'You can reach WelliRecord support at 08053355504 or inquiry@wellirecord.com.',
    options: [{ label: 'Back to menu', nextIntentKey: 'provider_start_over' }],
  },
];

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wellirecord';
  if (!uri) throw new Error('MONGODB_URI (or MONGO_URI) is not set.');

  console.log(`Connecting to MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);
  await mongoose.connect(uri);

  for (const intent of intents) {
    await ChatIntent.findOneAndUpdate({ intentKey: intent.intentKey }, intent, {
      upsert: true,
      new: true,
    });
  }

  console.log(`Migrated ${intents.length} provider chat intents into MongoDB.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Provider migration failed:', err);
  process.exit(1);
});
