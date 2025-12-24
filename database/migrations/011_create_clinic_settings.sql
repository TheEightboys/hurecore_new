-- Migration: 011_create_clinic_settings
-- Description: Settings for attendance policies, leave policies, and business hours

CREATE TABLE IF NOT EXISTS clinic_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
  
  -- Attendance Settings
  required_daily_hours DECIMAL(4,2) DEFAULT 8.00,  -- Standard workday hours
  unpaid_break_minutes INT DEFAULT 30,            -- Unpaid break duration
  late_threshold_minutes INT DEFAULT 15,          -- Grace period before marked late
  overtime_multiplier DECIMAL(3,2) DEFAULT 1.50,  -- OT pay multiplier (1.5x)
  
  -- Leave Policy Settings
  annual_leave_days INT DEFAULT 21,               -- Annual leave allowance
  sick_leave_days INT DEFAULT 10,                 -- Sick leave limit
  maternity_leave_days INT DEFAULT 90,
  paternity_leave_days INT DEFAULT 14,
  leave_carryover_allowed BOOLEAN DEFAULT FALSE,
  
  -- Business Hours (JSON for flexibility)
  business_hours JSONB DEFAULT '{
    "monday": {"open": "08:00", "close": "17:00", "closed": false},
    "tuesday": {"open": "08:00", "close": "17:00", "closed": false},
    "wednesday": {"open": "08:00", "close": "17:00", "closed": false},
    "thursday": {"open": "08:00", "close": "17:00", "closed": false},
    "friday": {"open": "08:00", "close": "17:00", "closed": false},
    "saturday": {"open": "09:00", "close": "13:00", "closed": false},
    "sunday": {"open": null, "close": null, "closed": true}
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic_id ON clinic_settings(clinic_id);

-- Auto-create settings for new clinics
CREATE OR REPLACE FUNCTION create_default_clinic_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO clinic_settings (clinic_id)
  VALUES (NEW.id)
  ON CONFLICT (clinic_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_default_clinic_settings ON clinics;
CREATE TRIGGER trigger_create_default_clinic_settings
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION create_default_clinic_settings();

-- Success
SELECT 'Migration 011: clinic_settings created' AS status;
