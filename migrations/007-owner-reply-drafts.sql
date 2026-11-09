-- Existing completed jobs keep their original result and start ready for review.
ALTER TABLE prospect_jobs
  ADD COLUMN reply_text text CHECK (length(reply_text) BETWEEN 1 AND 4000),
  ADD COLUMN reply_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN reply_version integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT prospect_reply_review_check CHECK (
    (reply_version = 0 AND reply_text IS NULL AND NOT reply_ready) OR
    (reply_version > 0 AND reply_text IS NOT NULL)
  );

ALTER TABLE enquiry_activity DROP CONSTRAINT enquiry_activity_kind_check;
ALTER TABLE enquiry_activity ADD CONSTRAINT enquiry_activity_kind_check CHECK (kind IN (
  'history_started','received','status_changed','notes_updated',
  'follow_up_scheduled','follow_up_changed','follow_up_cleared','follow_up_completed',
  'mail_attempted','mail_sent','mail_failed','prospect_queued','prospect_prepared',
  'reply_draft_saved','reply_draft_ready'
));
