-- Queue and result share the enquiry lifecycle; no duplicated intake payload.
ALTER TABLE enquiry_activity DROP CONSTRAINT enquiry_activity_kind_check;
ALTER TABLE enquiry_activity ADD CONSTRAINT enquiry_activity_kind_check CHECK (kind IN (
  'history_started','received','status_changed','notes_updated',
  'follow_up_scheduled','follow_up_changed','follow_up_cleared','follow_up_completed',
  'mail_attempted','mail_sent','mail_failed','prospect_queued','prospect_prepared'
));
CREATE TABLE prospect_jobs (
  id uuid PRIMARY KEY,
  enquiry_id uuid NOT NULL UNIQUE REFERENCES enquiries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  claim_token uuid,
  lease_until timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX prospect_jobs_queue ON prospect_jobs(status, created_at);
