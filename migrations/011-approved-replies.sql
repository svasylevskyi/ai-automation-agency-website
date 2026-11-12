-- One explicitly approved first reply per enquiry. Draft previews may be replaced;
-- after approval the exact envelope/body remains immutable for safe recovery.
CREATE TABLE reply_deliveries (
 id uuid PRIMARY KEY,
 enquiry_id uuid NOT NULL UNIQUE REFERENCES enquiries(id) ON DELETE CASCADE,
 review_version integer NOT NULL CHECK(review_version > 0),
 enquiry_version integer NOT NULL CHECK(enquiry_version > 0),
 provider text NOT NULL CHECK(provider IN ('smtp','resend')),
 status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','sending','accepted','unconfirmed')),
 payload jsonb NOT NULL,
 follow_up jsonb,
 follow_up_outcome text NOT NULL DEFAULT 'none' CHECK(follow_up_outcome IN ('none','pending','applied','not_applied')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 claim uuid,
 approved_at timestamptz,
 first_attempt_at timestamptz,
 attempted_at timestamptz,
 accepted_at timestamptz,
 provider_message_id text,
 failure_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE enquiry_activity DROP CONSTRAINT enquiry_activity_kind_check;
ALTER TABLE enquiry_activity ADD CONSTRAINT enquiry_activity_kind_check CHECK (kind IN (
 'history_started','received','status_changed','notes_updated',
 'follow_up_scheduled','follow_up_changed','follow_up_cleared','follow_up_completed',
 'mail_attempted','mail_sent','mail_failed','prospect_queued','prospect_prepared',
 'reply_draft_saved','reply_draft_ready','reply_send_approved','reply_unconfirmed',
 'reply_follow_up_skipped'
));
