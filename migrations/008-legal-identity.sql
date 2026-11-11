-- Apply the supplied identity to existing documents without replacing their body.
-- Fresh installations receive the same wording from src/content at seeding.
WITH revised AS (
  SELECT slug,
    replace(
      replace(
        replace(
          replace(content,
            '[LEGAL_NAME]', 'Stepan Vasylevskyi - InfoTech Consulting'),
          '[TRADING_NAME]', 'Get Automated'),
        '[WEBSITE_URL]', 'https://get-automated.ai'),
      'This Privacy Policy explains how personal data is handled when you visit this website,',
      'This Privacy Policy explains how personal data is handled when you visit https://get-automated.ai,'
    ) AS content
  FROM legal_pages
  WHERE slug IN ('privacy', 'terms')
)
UPDATE legal_pages AS page
SET content = revised.content,
    version = page.version + 1,
    updated_at = now()
FROM revised
WHERE page.slug = revised.slug AND page.content IS DISTINCT FROM revised.content;
