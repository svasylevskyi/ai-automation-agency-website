ALTER TABLE enquiries
  ADD COLUMN next_action text NOT NULL DEFAULT '' CHECK (length(next_action) <= 300),
  ADD COLUMN follow_up_on date,
  ADD COLUMN notification_claim uuid,
  ADD COLUMN confirmation_status text NOT NULL DEFAULT 'not_required'
    CHECK (confirmation_status IN ('not_required','pending','sending','sent','failed')),
  ADD COLUMN confirmation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN confirmation_attempted_at timestamptz,
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmation_claim uuid,
  ADD COLUMN confirmation_payload jsonb,
  ADD CONSTRAINT enquiry_follow_up_pair CHECK ((next_action = '') = (follow_up_on IS NULL)),
  ADD CONSTRAINT enquiry_closed_follow_up CHECK (status <> 'closed' OR next_action = '');

CREATE INDEX enquiries_follow_up_idx ON enquiries (follow_up_on, created_at) WHERE status <> 'closed';

CREATE TABLE enquiry_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'history_started','received','status_changed','notes_updated',
    'follow_up_scheduled','follow_up_changed','follow_up_cleared','follow_up_completed',
    'mail_attempted','mail_sent','mail_failed'
  )),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX enquiry_activity_enquiry_idx ON enquiry_activity (enquiry_id, id DESC);

-- Earlier enquiries retain their state and are never sent retrospective receipts.
INSERT INTO enquiry_activity (enquiry_id,kind) SELECT id,'history_started' FROM enquiries;

-- Refresh only untouched initial review drafts; preserve every owner-edited page.
UPDATE legal_pages SET content=replace(replace(replace(replace(content,'The owner may add private follow-up notes and a status to manage the conversation.','The owner may add private notes, a status, a next action and a follow-up date to manage the conversation. We keep an activity history of status changes, scheduled, changed, cleared or completed actions, note-update times, and email attempts and outcomes. Previous private-note text is not copied into that history. Confirmation-email wording is saved with the enquiry so retries use the same receipt.'),'Where you ask us to take steps towards a possible contract with you personally, necessary enquiry handling is based on Article 6(1)(b) GDPR.','Enquiry handling includes acknowledging receipt, reviewing your request and following up with you. Where you ask us to take steps towards a possible contract with you personally, necessary enquiry handling is based on Article 6(1)(b) GDPR.'),'Owner notifications contain a private inbox link, not your message, assessment or contact details. In the current test environment, these notifications are captured locally on the server. Any provider used for direct email correspondence must be identified before live use: [CORRESPONDENCE_PROVIDER_AND_LOCATION].','Owner notifications contain a private inbox link, not your message, assessment or contact details. We also send a short automatic confirmation to the email address supplied with a new enquiry. It contains general next steps and an optional booking link, without copying your name, message or assessment. The mail service processes the recipient address and delivery metadata to handle that email. In the current test environment, both types of email are captured locally on the server. The provider used for live confirmations and direct correspondence must be identified before live use: [CORRESPONDENCE_PROVIDER_AND_LOCATION].'),'Unsuccessful or completed enquiries and follow-up notes:','Unsuccessful or completed enquiries, follow-up notes, actions, activity history and email-attempt records:'),version=version+1,updated_at=now() WHERE slug='privacy' AND is_draft AND version=1 AND md5(content)='7bce7013913baf9fdcd5eedd26512d34';
UPDATE legal_pages SET content=replace(content,'A technical acknowledgement is not acceptance of a project or a promise to reply within a particular period.','We also attempt to send a short confirmation email. Email delivery can be delayed or fail; the on-screen confirmation still means the enquiry was saved. A technical acknowledgement is not acceptance of a project or a promise to reply within a particular period.'),version=version+1,updated_at=now() WHERE slug='terms' AND is_draft AND version=1 AND md5(content)='850a416a82b0abf08b2951855f9688ba';
