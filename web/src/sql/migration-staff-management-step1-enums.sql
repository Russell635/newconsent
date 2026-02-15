-- Migration: Staff Management Step 1 — Add manager and nurse roles
-- Run this BEFORE migration-staff-management.sql

-- Add 'manager' and 'nurse' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nurse';

-- Must commit before these values can be used in subsequent statements
