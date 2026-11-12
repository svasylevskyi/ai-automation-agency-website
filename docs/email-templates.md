# Branded enquiry emails

New owner notifications and visitor acknowledgements include HTML and plain text. The HTML uses the website's Orbit palette: lavender `#f4f1fc`, dark purple `#30234e`, accent `#6b48c4`, white cards, rounded corners and a logo/name footer. Inline styles, presentation tables, system fonts and a fluid container support email clients without requiring JavaScript or downloaded fonts.

## Visitor acknowledgement

- Greeting: `Hello Stepan,` using the full name supplied, with whitespace normalised. No title, gender or guessed first name is used.
- Fallback: `Hello,` when the template receives no usable name. The public form's existing name requirement is unchanged.
- Ending: `Best regards,` followed by the agency name and logo in the HTML footer; the plain-text version includes the agency name and website address.
- Existing receipt/next-step wording, optional booking link, Reply-To and auto-response suppression headers remain. Only the greeting uses visitor input. The enquiry message, assessment, company, tools and private notes are not included.
- Names and all other variable text are escaped before rendering into HTML. Link URLs are validated; the subject and headers never use the visitor's name.

## Owner notification

The owner receives the same visual treatment and sign-off, with a **Review the enquiry** button linking to the protected enquiry page. It does not contain visitor contact details or their enquiry message. The private admin link is never included in visitor acknowledgements.

## Branding and images

Agency name, tagline and any uploaded PNG logo come from the same owner settings as the website. The original orbit SVG has a 256px PNG export at `public/brand/email-mark.png` for email clients that cannot display SVG. Uploaded logos keep their aspect ratio within a 120 × 40px footer area.

Logo and website URLs use the server's `APP_URL`, independently of search indexing. Logos are public website assets, with no per-recipient image URLs or tracking pixels added. Some clients block images until the recipient allows them; the agency name, body text and links remain readable. Keep provider open/click tracking disabled if that is your current configuration.

## Deployment and retries

Merge and run **Deploy website to Hetzner** as usual. Migration `010-branded-emails.sql` adds the notification snapshot column. No new provider settings or credentials are needed.

Both new message bodies are saved when the enquiry is created. Retries keep the original greeting, wording, branding URLs and links even if owner settings change later. Historical acknowledgements and notifications retain their original plain-text content and are not retroactively resent or restyled. Existing sender/recipient configuration and Resend's 24-hour idempotency limit still apply.

The bundled Privacy Policy now explains that acknowledgements may greet visitors by name. The migration replaces only the matching old template sentence in saved policies, preserving other edits and draft/publication state. If you wrote a different description of acknowledgement contents, review that wording to keep it accurate.

## Review after deployment

1. Submit a fresh test enquiry using an address you control. Verify both HTML messages, greeting, sign-off and footer in Gmail on desktop and phone.
2. Reply to the acknowledgement and check that it still goes to the configured public business email.
3. Check the optional booking button when a booking URL is configured, and the owner button's protected destination.
4. Check the plain-text alternative (for example, in the downloaded original message) and the display with images disabled.

Automated coverage checks greeting fallbacks, international names, escaping, booking URLs, logo sizing, private-link separation, legacy snapshots, provider HTML/text mapping, and stable retries through the database. Offline renders help inspect layout, but do not replace a check in the actual receiving email client.
