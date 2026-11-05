CREATE TABLE site_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE TABLE site_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE brand_assets (
  id uuid PRIMARY KEY,
  data bytea NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE enquiries (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL DEFAULT '',
  area text NOT NULL CHECK (area IN ('sales','operations','support')),
  team_size text NOT NULL CHECK (team_size IN ('small','mid','large')),
  message text NOT NULL,
  privacy_notice_version text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','in_progress','closed')),
  notes text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sending','sent','failed')),
  notification_attempts integer NOT NULL DEFAULT 0,
  notification_attempted_at timestamptz,
  notified_at timestamptz
);
CREATE INDEX enquiries_created_idx ON enquiries (created_at DESC, id DESC);
CREATE INDEX enquiries_status_created_idx ON enquiries (status, created_at DESC);
CREATE TABLE request_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX request_limits_expiry_idx ON request_limits(expires_at);
