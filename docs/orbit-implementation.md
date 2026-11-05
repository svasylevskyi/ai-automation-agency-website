# Orbit implementation

## Scope

Promotes the selected Orbit concept into a Next.js App Router site with TypeScript and Tailwind v4 support. `drafts/` is preserved byte-for-byte. The public page lives at `/`; design-review labels and gallery navigation are removed from it.

The first production build is a static export for inexpensive Hetzner hosting. The public site has no server endpoints, accounts or data collection. No admin features or external integrations have been implemented.

## Navigation regression

The draft applied `.nav a[aria-current="location"]::after` to every link, including the CTA. The website uses two distinct classes: `.nav-link` gets the current-section underline; `.nav-cta` explicitly has no text decoration or generated indicator in any link state. Its active state uses background and border colour. Keyboard focus outlines remain visible.

The mobile menu is a native `details`/`summary` disclosure. JavaScript adds Escape, outside-click, focus-leave and navigation dismissal; a browser without JavaScript still provides a usable menu. Anchor offsets follow the header's actual height, including after replacing the brand. Scroll tracking accounts for a short final section at the bottom of the document.

## Identity changes

`src/config/brand.ts` drives the name, accessible labels, header/footer mark, favicon, page title and sharing metadata. The illustration does not contain a hard-coded initial. Use a transparent SVG/PNG/WebP in `public/brand/`, update its ratio, and optionally hide the adjacent text for a complete wordmark logo. Branding changes require a new static build; the reference drafts remain historical.

## Checks

- `npm run check`: TypeScript, three planner tests and production static export.
- Browser checks use the built static export, not the development server.
- Chromium: no horizontal overflow at nominal frame widths 320, 390, 768, 800, 801 and 1280 px (the iframe's scrollbar reduces its content width by 15 px).
- Verified the CTA with `aria-current="location"` on mobile and desktop: no text decoration and no `::after` content. Keyboard focus remains visible; Escape restores focus to the menu trigger.
- Exercised close-on-navigation, outside-click dismissal, all three workflow examples, FAQ expansion and planner recommendations.
- Built a temporary replacement identity with a longer name and a 3:1 logo: no overflow at the narrowest frame, metadata followed the new name, and the contact anchor stayed below the taller header. Restored the working identity before the final build.
- Safari, Firefox, physical touch devices and a full assistive-technology audit remain unverified.

## Before public launch

Choose the final identity and domain; configure an owner-approved enquiry or booking destination; review service wording and the legal/privacy information for the actual data collection and providers. Keep `siteUrl` empty during review (`noindex`), then set the real HTTPS origin when launch-ready. Deploy `out/` only. Live submission and an authenticated owner area are a separate increment.
