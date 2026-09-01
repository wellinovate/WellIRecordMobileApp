/**
 * WelliRecord MongoDB Database Seeder
 * Seeds initial Lagos hospitals, diagnostic labs, pharmacies, and demo patient profiles.
 */

import mongoose from 'mongoose';
import { User, Profile, FamilyMember, Facility, HealthRecord, Prescription } from './models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wellirecord';

const FACILITIES_DATA = [
  {
    name: 'Lagoon Hospital Lekki',
    typeLabel: 'Multi-Specialist Hospital',
    specialty: 'Cardiology, Surgery & Critical Care',
    address: 'Plot 21, Admiralty Way, Lekki Phase 1, Lagos',
    city: 'Lagos',
    state: 'Lagos State',
    acceptedHmos: ['Hygeia', 'AXA Mansard', 'Reliance', 'Leadway Health'],
    emoji: '🏥',
    isVerified: true,
  },
  {
    name: 'Reddington Multi-Specialist Hospital',
    typeLabel: 'Tertiary Medical Center',
    specialty: 'Internal Medicine, Neurology & Trauma',
    address: '12 Idowu Martins Street, Victoria Island, Lagos',
    city: 'Lagos',
    state: 'Lagos State',
    acceptedHmos: ['Hygeia', 'AXA Mansard', 'Avon HMO', 'Total Health Trust'],
    emoji: '🏥',
    isVerified: true,
  },
  {
    name: 'SYNLAB Diagnostic Laboratories',
    typeLabel: 'ISO-15189 Accredited Lab',
    specialty: 'Clinical Pathology, Genomics & Biomarkers',
    address: 'Block 6, Babatunde Anjous Avenue, Lekki Phase 1, Lagos',
    city: 'Lagos',
    state: 'Lagos State',
    acceptedHmos: ['Hygeia', 'AXA Mansard', 'Reliance', 'Leadway'],
    emoji: '🔬',
    isVerified: true,
  },
  {
    name: 'Riverside Family Clinic',
    typeLabel: 'Primary Care & Pediatrics',
    specialty: 'Family Medicine & Preventive Wellness',
    address: '14 Emma Abimbola Cole Street, Lekki Phase 1, Lagos',
    city: 'Lagos',
    state: 'Lagos State',
    acceptedHmos: ['Hygeia', 'AXA Mansard', 'Reliance'],
    emoji: '🩺',
    isVerified: true,
  },
  {
    name: 'MediTrust Pharmacy & Diagnostics',
    typeLabel: '24/7 E-Pharmacy & Express Lab',
    specialty: 'Prescription Refills, Rapid Diagnostics & HMO Dispensing',
    address: 'Block 12, Admiralty Way, Lekki Phase 1, Lagos',
    city: 'Lagos',
    state: 'Lagos State',
    acceptedHmos: ['Hygeia', 'AXA Mansard', 'Reliance', 'Leadway Health'],
    emoji: '💊',
    isVerified: true,
  },
];

async function seedDatabase() {
  console.log(`[Seed] Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);

  console.log('[Seed] Clearing previous collections...');
  await Promise.all([
    User.deleteMany({}),
    FamilyMember.deleteMany({}),
    Facility.deleteMany({}),
    HealthRecord.deleteMany({}),
    Prescription.deleteMany({}),
  ]);

  console.log('[Seed] Inserting Lagos Healthcare Facilities...');
  await Facility.insertMany(FACILITIES_DATA);

  console.log('[Seed] Creating primary account (Amara Nwosu)...');
  const user = await User.create({
    phoneNumber: '+2348053355504',
    email: 'amara.nwosu@gmail.com',
    fullName: 'Amara Nwosu',
    bloodType: 'O+',
    genotype: 'AA',
    hmoProvider: 'Hygeia HMO',
    hmoPolicyNumber: 'HYG-992014-LAG',
    isPhoneVerified: true,
    twoFactorEnabled: true,
  });

  console.log('[Seed] Creating family members...');
  const selfMember = await FamilyMember.create({
    userId: user._id,
    name: 'Amara Nwosu',
    initials: 'AN',
    relationship: 'Self',
    role: 'owner',
    dob: new Date('1994-06-15'),
    gender: 'Female',
    bloodType: 'O+',
    genotype: 'AA',
    allergies: 'Penicillin, Shellfish',
  });

  const childMember = await FamilyMember.create({
    userId: user._id,
    name: 'Kwame Nwosu',
    initials: 'KN',
    relationship: 'Child',
    role: 'dependent',
    dob: new Date('2024-03-10'),
    gender: 'Male',
    bloodType: 'O+',
    genotype: 'AA',
    allergies: 'None recorded',
  });

  console.log('[Seed] Creating health records & lab biomarkers...');
  await HealthRecord.create({
    userId: user._id,
    familyMemberId: selfMember._id,
    title: 'Comprehensive Metabolic & Fasting Glucose',
    date: 'May 12, 2026',
    recordType: 'Lab Result',
    provider: 'SYNLAB Diagnostic Laboratories Lekki',
    summary: 'Fasting Glucose 94 mg/dL (Normal). HbA1c 5.6%. Kidney & liver panels within standard limits.',
    labReportDetails: {
      specimenType: 'Venous Blood (Fluoride / Serum)',
      collectedDate: 'May 12, 2026 · 07:30 AM',
      reportedDate: 'May 12, 2026 · 02:45 PM',
      pathologist: 'Dr. Chinedu Okafor (MBBS, FMCPath)',
      labLicenseNo: 'MLCN-LAB-88201',
      specimenId: 'SPEC-2026-99042',
      clinicalInterpretation: 'Normal glycemic profile. Fasting plasma glucose and HbA1c are well within reference intervals.',
      biomarkers: [
        { analyte: 'Fasting Plasma Glucose (FPG)', result: '94', unit: 'mg/dL', referenceInterval: '70 – 99', status: 'optimal' },
        { analyte: 'Hemoglobin A1c (HbA1c)', result: '5.6', unit: '%', referenceInterval: '4.0 – 5.6', status: 'optimal' },
        { analyte: 'Estimated GFR (eGFR)', result: '> 90', unit: 'mL/min/1.73m²', referenceInterval: '> 60', status: 'normal' },
        { analyte: 'Serum Creatinine', result: '0.9', unit: 'mg/dL', referenceInterval: '0.6 – 1.2', status: 'normal' },
      ],
    },
  });

  await HealthRecord.create({
    userId: user._id,
    familyMemberId: childMember._id,
    title: 'Nigerian NPI Immunization Certificate (Pentavalent & Polio)',
    date: 'April 04, 2026',
    recordType: 'Immunization',
    provider: 'Riverside Family Clinic Lekki',
    summary: 'Pentavalent 3rd dose, Inactivated Polio Vaccine (IPV-1), and Pneumococcal Conjugate (PCV-3) administered.',
    ocrData: {
      keyValues: [
        { label: 'Child Name', value: 'Kwame Nwosu' },
        { label: 'Schedule', value: 'NPI 14 Weeks Milestone' },
        { label: 'Batch No', value: 'NPI-2026-9941' },
      ],
      statusBadge: 'NPI Verified',
    },
  });

  console.log('[Seed] Creating prescriptions...');
  await Prescription.create({
    userId: user._id,
    familyMemberId: selfMember._id,
    medicationName: 'Amlodipine 5mg Daily',
    dosage: '1 tablet once daily in the morning',
    frequency: 'Daily · 30-Day Supply',
    prescriber: 'Dr. Sarah Chen (MBBS, FWACP)',
    pharmacyProvider: 'MediTrust Pharmacy & Diagnostics · Lekki Phase 1',
    totalPriceNaira: 6500,
    hmoCoveredNaira: 5200,
    patientCoPayNaira: 1300,
    refillsTotal: 3,
    refillsRemaining: 2,
    status: 'active',
    deliveryAddress: 'Block 12, Admiralty Way, Lekki Phase 1, Lagos',
    hmoProvider: 'Hygeia HMO (80% Tariff Co-Pay)',
  });

  console.log('[Seed] Creating/updating profile for Chibuike Joshua Nwogha...');
  const testAccountId = new mongoose.Types.ObjectId('6a626749a25c1d8dadfff6dd');
  await Profile.findOneAndUpdate(
    { $or: [{ accountId: testAccountId }, { email: 'talk2jaywin@gmail.com' }, { phone: '07030144923' }] },
    {
      accountId: testAccountId,
      fullName: 'Chibuike Joshua Nwogha',
      dateOfBirth: new Date('1986-09-16'),
      gender: 'Male',
      email: 'talk2jaywin@gmail.com',
      phone: '07030144923',
      memberId: 'WR-2WJX-P7Y4',
      bloodType: 'O+',
      genotype: 'AA',
      hmoProvider: 'Hygeia HMO',
      hmoPolicyNumber: 'HYG-992014-LAG',
      isAccountLinked: true,
      isProvisional: false,
    },
    { upsert: true, new: true }
  );

  console.log('✅ [Seed] MongoDB database successfully populated with Lagos healthcare data!');
  await mongoose.disconnect();
}

seedDatabase().catch((err) => {
  console.error('❌ [Seed] Error populating MongoDB:', err);
  process.exit(1);
});
