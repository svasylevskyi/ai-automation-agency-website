-- Existing enquiries remain unchanged and have no attached assessment.
ALTER TABLE enquiries DROP CONSTRAINT enquiries_area_check;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_area_check
  CHECK (area IN ('sales', 'operations', 'support', 'other'));
ALTER TABLE enquiries ADD COLUMN assessment jsonb;
