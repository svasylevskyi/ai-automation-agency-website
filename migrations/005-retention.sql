ALTER TABLE enquiries ADD COLUMN closed_at timestamptz;
-- Start the clock conservatively for previously closed records.
UPDATE enquiries SET closed_at=now() WHERE status='closed';
CREATE FUNCTION track_enquiry_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'closed' THEN NEW.closed_at := NULL;
  ELSIF TG_OP='INSERT' THEN NEW.closed_at := now();
  ELSIF OLD.status <> 'closed' THEN NEW.closed_at := now();
  ELSE NEW.closed_at := OLD.closed_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enquiry_closure BEFORE INSERT OR UPDATE ON enquiries
FOR EACH ROW EXECUTE FUNCTION track_enquiry_closure();
CREATE INDEX enquiries_retention_idx ON enquiries (closed_at) WHERE status='closed';

CREATE TABLE retention_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 days integer NOT NULL DEFAULT 180 CHECK(days BETWEEN 30 AND 3650),
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_cleanup_at timestamptz,
 last_deleted_count integer NOT NULL DEFAULT 0
);
INSERT INTO retention_policy(singleton) VALUES(true);

-- Minimal recovery evidence, never names, addresses, notes or enquiry text.
CREATE TABLE enquiry_deletions (
 enquiry_id uuid PRIMARY KEY,
 deleted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX enquiry_deletions_time_idx ON enquiry_deletions(deleted_at);
CREATE FUNCTION remember_enquiry_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO enquiry_deletions(enquiry_id) VALUES(OLD.id) ON CONFLICT DO NOTHING;
 RETURN OLD;
END;
$$;
CREATE TRIGGER enquiry_deletion AFTER DELETE ON enquiries
FOR EACH ROW EXECUTE FUNCTION remember_enquiry_deletion();
