# AI Automation Agency — Orbit website

The selected Orbit direction is now a responsive Next.js/TypeScript website. It retains the lavender palette, orbital illustration, single-page sections and compact sticky navigation. **Automation Studio and the mark are provisional.**

All five original concepts remain unchanged in [`drafts/`](drafts/index.html). They are reference files, not public production routes.

## Run and build

Use Node 24 LTS (see `.nvmrc`; minimum 22.18) and npm:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. For validation and a portable static build:

```sh
npm run check
```

This runs TypeScript, planner unit tests and the production build. `npm run build` exports HTML/CSS/JS to `out/`; there is no runtime Node server or database yet. To review that exact build locally:

```sh
python3 -m http.server 8000 --directory out
```

## Change the name and logo

Edit [`src/config/brand.ts`](src/config/brand.ts):

- `name`: header/footer wordmark, accessible home links, document title and sharing metadata.
- `logo.src`, `logo.width`, `logo.height`: replace the mark with an asset in `public/brand/`. Set dimensions to the asset's natural ratio.
- `logo.showName`: set `false` if the supplied logo already contains the agency name.
- `icon`: the favicon asset, which may differ from the main logo.
- `description`, `tagline` and founder details: centrally managed copy.
- `contactEmail` / `bookingUrl`: owner-approved public contact destinations; currently blank. A configured link appears after the planner recommendation.
- `siteUrl`: the final HTTPS origin. Leave blank for review builds, which emit `noindex`. Set it only when the site is ready for public indexing.

Rebuild after changes. The shared Brand component supports wrapping names and rectangular marks. Anchor offsets adapt to header height. The decorative hero orbit is a workflow illustration, independent of the agency logo. Historic drafts intentionally retain their original working identity.

The Orbit colour tokens live at the top of `src/app/globals.css`. Tailwind v4 utilities are available; the approved composition uses readable component CSS without Tailwind's reset changing the draft layout.

## What works now

- Sticky header; native mobile menu disclosure, also usable without JavaScript.
- Anchor navigation, current-section tracking, Escape/outside-click dismissal and close-on-navigation.
- “Let’s talk” uses a background/border selected state. Underline markers apply only to ordinary menu links; the CTA retains a keyboard focus outline.
- Three illustrative workflow examples, native FAQs and a browser-local assessment planner.
- Skip link, reduced-motion support, labelled controls and server-rendered public content.
- Central metadata and replaceable branding; no external fonts, images or analytics requests.

The planner sends and stores no data. There is no enquiry submission, authentication, admin area, CRM integration or live deployment in this increment. Do not present the examples as client results.

## Structure

```text
src/app/           Public page, layout, metadata and Orbit styles
src/components/    Header, shared branding and interactive sections
src/config/        Provisional brand and public contact configuration
src/lib/           Workflow examples and recommendation logic
public/brand/      Replaceable identity assets
tests/             Planner checks
out/               Generated static export (ignored)
drafts/            All five original HTML design options (retained)
docs/              Design history, implementation and hosting notes
```

See [Orbit implementation and verification](docs/orbit-implementation.md) and the earlier [hosting/Webflow comparison](docs/hosting-and-rollout.md). That comparison is historical research dated 5 November 2026; verify vendor terms before purchasing.

## Deployment boundary

Serve **only `out/`** on Hetzner with Caddy/nginx. Do not serve the repository root, which contains reference drafts and source. Build a release, upload it into a new directory, switch the web root/symlink after a smoke check, and retain the previous release for rollback. No server access, DNS changes or deployment credentials are configured here.

Next.js [static exports](https://nextjs.org/docs/app/guides/static-exports) remain portable across static web hosts. A future authenticated admin area with stored enquiries will need a backend: either switch this application to a server deployment or provide a separate service. That decision and implementation are deferred.
