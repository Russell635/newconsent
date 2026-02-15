-- ============================================
-- CONSENT FLOW MIGRATION — STEP 1: ENUM ADDITIONS
-- Run this FIRST, then run migration-consent-flow.sql
-- PostgreSQL requires new enum values to be committed
-- before they can be used in the same session.
-- ============================================

-- Add new user roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'patient';

-- Add new consent statuses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'not_started' AND enumtypid = 'consent_status'::regtype) THEN
    ALTER TYPE consent_status ADD VALUE 'not_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'patient_completed' AND enumtypid = 'consent_status'::regtype) THEN
    ALTER TYPE consent_status ADD VALUE 'patient_completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'under_review' AND enumtypid = 'consent_status'::regtype) THEN
    ALTER TYPE consent_status ADD VALUE 'under_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'valid' AND enumtypid = 'consent_status'::regtype) THEN
    ALTER TYPE consent_status ADD VALUE 'valid';
  END IF;
END$$;
