CREATE TABLE legal_pages (
  slug text PRIMARY KEY CHECK (slug IN ('privacy', 'terms')),
  title text NOT NULL,
  content text NOT NULL,
  is_draft boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
