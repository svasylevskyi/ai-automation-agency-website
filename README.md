# AI Automation Agency — five website directions

Five complete, responsive HTML concepts for a founder-led automation agency serving small and medium-sized businesses, with a route to larger clients.

## Review

Open [`drafts/index.html`](drafts/index.html) directly in a browser. Each concept is a self-contained HTML file with inline CSS/JavaScript, inline SVG and no external font, image, analytics or package dependencies.

Alternatively, from the repository root:

```sh
python3 -m http.server 8000 --directory drafts
```

Then open `http://localhost:8000`.

| Design | Direction | Particularly useful for |
| --- | --- | --- |
| [01 Signal](drafts/designs/01-signal.html) | Dark graphite, mint, orbital workflow | A visibly technical but approachable AI studio |
| [02 Prism](drafts/designs/02-prism.html) | Pearl white, electric blue, translucent layers, editorial rows | Clarity and broad SMB appeal |
| [03 Vector](drafts/designs/03-vector.html) | Graphite, acid lime, oversized typography, structural grids | A bold, distinct technology brand |
| [04 Orbit](drafts/designs/04-orbit.html) | Soft lavender, rounded forms, centred hero, asymmetric service layout | An accessible first step into automation |
| [05 Atlas](drafts/designs/05-atlas.html) | Warm stone, forest green, architectural panels | A premium advisory brand and larger-company conversations |

## Included interactions

- Sticky 72 px desktop / 64 px mobile header.
- Collapsible mobile navigation with ARIA state, Escape dismissal, outside-click dismissal and close-on-navigation.
- Native anchor scrolling, active-section indication and heading offsets.
- Three switchable illustrative workflows.
- Native FAQ disclosures.
- Local enquiry-planner preview, with distinct recommendations by workflow and organisation size. No submission, network request or storage.
- Keyboard focus styles, skip link, reduced-motion preference and a useful no-JavaScript fallback.

“Automation Studio” is a working name. Proposed service language is illustrative, not a claim of delivered client results. No testimonials, customer logos, savings figures or certifications are invented. Production booking, lead capture, policies, analytics and deployment are deliberately not connected at this design-review stage.

## Implementation and hosting

Read [the hosting comparison, Webflow stack changes and rollout guide](docs/hosting-and-rollout.md). The recommended next implementation is a portable Next.js/TypeScript/Tailwind site, initially exported statically to Hetzner if the existing environment is suitable. No framework is installed just to review these designs.

Keep the scroll-based homepage, then add dedicated service/case-study/legal URLs when their content warrants them. Avoid scroll hijacking and mandatory section snapping.

See [verification notes](docs/design-review.md) for the tested scope and remaining production checks.

## Scope of this change

This is a design review package. It does not select a final brand, deploy a public production site, modify existing Hetzner projects, purchase plans or connect external services.
