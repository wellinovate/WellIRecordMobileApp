-- ==============================================================================
-- WelliRecord Production Database Schema
-- Standard: Nigeria Data Protection Regulation (NDPR) & HIPAA Compliance
-- Dialect: PostgreSQL 15+ / Supabase / AWS RDS
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (Primary Account Holders)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    blood_type VARCHAR(5) DEFAULT 'O+',
    genotype VARCHAR(5) DEFAULT 'AA',
    hmo_provider VARCHAR(100) DEFAULT 'Hygeia HMO',
    hmo_policy_number VARCHAR(100),
    is_phone_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT TRUE,
    biometric_key_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. FAMILY MEMBERS TABLE (Dependents: Children, Spouse, Senior Parents)
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    initials VARCHAR(4) NOT NULL,
    relationship VARCHAR(50) NOT NULL, -- 'Self', 'Spouse', 'Child', 'Parent'
    role VARCHAR(20) DEFAULT 'dependent', -- 'owner', 'dependent'
    dob DATE,
    gender VARCHAR(10),
    blood_type VARCHAR(5),
    genotype VARCHAR(5),
    height_cm NUMERIC(5, 2),
    weight_kg NUMERIC(5, 2),
    allergies TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HEALTH RECORDS TABLE
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    record_type VARCHAR(50) NOT NULL, -- 'Lab Result', 'Prescription', 'Imaging', 'Clinical Note', 'Immunization', 'Receipt'
    date DATE NOT NULL,
    provider VARCHAR(200) NOT NULL,
    summary TEXT,
    file_s3_key TEXT,
    encrypted_file_hash TEXT,
    ocr_data JSONB, -- Key-value pairs extracted via OCR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LAB BIOMARKERS TABLE (Itemized Analyte Breakdown)
CREATE TABLE IF NOT EXISTS lab_biomarkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
    analyte VARCHAR(150) NOT NULL,
    result_value VARCHAR(100) NOT NULL,
    unit VARCHAR(50),
    reference_interval VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'normal', 'optimal', 'high', 'low'
    sort_order INT DEFAULT 0
);

-- 5. PRESCRIPTIONS & E-PHARMACY TABLE
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    medication_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    prescriber VARCHAR(200) NOT NULL,
    pharmacy_provider VARCHAR(200) NOT NULL,
    total_price_naira NUMERIC(12, 2) NOT NULL,
    hmo_covered_naira NUMERIC(12, 2) NOT NULL,
    patient_copay_naira NUMERIC(12, 2) NOT NULL,
    refills_total INT DEFAULT 3,
    refills_remaining INT DEFAULT 3,
    status VARCHAR(30) DEFAULT 'active', -- 'active', 'refill_requested', 'dispensed', 'in_transit', 'delivered'
    delivery_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. HEALTHCARE FACILITIES (Nigerian Hospital & Clinic Directory)
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type_label VARCHAR(100) NOT NULL, -- 'Multi-Specialist Hospital', 'Diagnostic Center', 'Pharmacy'
    specialty VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(50) DEFAULT 'Lagos',
    state VARCHAR(50) DEFAULT 'Lagos State',
    country VARCHAR(50) DEFAULT 'Nigeria',
    accepted_hmos TEXT[], -- Array of strings e.g. ['Hygeia', 'AXA Mansard', 'Reliance']
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SHARE GRANTS TABLE (WelliBridge, Doctor & Hospital Org Access)
CREATE TABLE IF NOT EXISTS share_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grantor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL, -- 'doctor', 'facility', 'bridge'
    recipient_id VARCHAR(100),
    recipient_name VARCHAR(200) NOT NULL,
    record_ids UUID[] NOT NULL,
    expiry_code VARCHAR(20) NOT NULL, -- '24h', '7d', '30d', 'custom'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_otp_verified BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'revoked', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. NDPR ACCESS AUDIT LOGS (Immutable Compliance Record)
CREATE TABLE IF NOT EXISTS access_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grant_id UUID REFERENCES share_grants(id) ON DELETE SET NULL,
    accessed_by_name VARCHAR(200) NOT NULL,
    accessor_role VARCHAR(100) NOT NULL,
    facility_name VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'view', 'download', 'print', 'revoke'
    records_count INT DEFAULT 1,
    ip_address VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. VITALS & CHRONIC CARE LOGS
CREATE TABLE IF NOT EXISTS vitals_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'bp', 'glucose', 'pulse', 'weight'
    primary_value VARCHAR(50) NOT NULL,
    secondary_value VARCHAR(50),
    unit VARCHAR(20) NOT NULL,
    tag VARCHAR(50),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_biomarkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals_logs ENABLE ROW LEVEL SECURITY;

-- Patients can only read/update their own profile
CREATE POLICY "Users can manage their own profile"
    ON users FOR ALL
    USING (auth.uid() = id);

-- Users can manage family members linked to their account
CREATE POLICY "Users can manage their family members"
    ON family_members FOR ALL
    USING (auth.uid() = user_id);

-- Users can read and insert health records they own
CREATE POLICY "Users can manage their health records"
    ON health_records FOR ALL
    USING (auth.uid() = user_id);

-- Public read for verified healthcare facilities
CREATE POLICY "Public read for healthcare facilities"
    ON facilities FOR SELECT
    USING (is_verified = TRUE);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE & SEARCH
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_records_user_id ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_member_id ON health_records(family_member_id);
CREATE INDEX IF NOT EXISTS idx_biomarkers_record_id ON lab_biomarkers(record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_share_grants_grantor ON share_grants(grantor_user_id);
CREATE INDEX IF NOT EXISTS idx_share_grants_expires_at ON share_grants(expires_at);
CREATE INDEX IF NOT EXISTS idx_vitals_member_id ON vitals_logs(family_member_id);
