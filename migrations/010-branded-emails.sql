-- New notifications capture branding/HTML once, just like confirmations. Leave
-- older notifications null so their existing plain-text retry payload is preserved.
ALTER TABLE enquiries ADD COLUMN notification_payload jsonb;

-- Update only the old template's exact receipt description. Keep all other owner
-- edits, draft/publication state and historical receipt snapshots intact.
UPDATE legal_pages
SET content=replace(content, 'It contains general next steps and an optional booking link, without copying your name, message or assessment.', 'It may greet you by the name you supplied and contains general next steps and an optional booking link, without copying your message or assessment.'),
    version=version+1, updated_at=now()
WHERE slug='privacy' AND strpos(content, 'It contains general next steps and an optional booking link, without copying your name, message or assessment.') > 0;
