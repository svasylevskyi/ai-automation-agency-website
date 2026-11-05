# Design review and verification

Reviewed 5 November 2026.

## What is ready

The gallery and five concepts are complete, self-contained HTML/CSS/JavaScript drafts. Each presents the offer, three solution areas, an interactive illustrative workflow, the assessment-to-support process, a larger-organisation pathway, FAQs and a local enquiry preview.

The five concepts have deliberately different typography, hero composition, geometry, colour and service/process layouts. They are not only colour variants. Signal is the strongest starting point for a visibly futuristic agency; Prism is the most neutral/light direction; Atlas is the most formal advisory direction.

## Checks performed

- Parsed all seven deliverable HTML pages: one main heading each, unique IDs, valid local link targets and valid section anchor targets.
- Parsed the JavaScript in all five concepts with `node --check`.
- Inspected all five desktop hero layouts in Chromium.
- Inspected responsive layouts in same-origin browser frames at nominal widths of 320, 390, 768 and 1280 px. Chromium's visible scrollbar consumes part of the inner content width. Confirmed no horizontal document overflow after correcting the narrow Orbit illustration.
- Exercised mobile menu opening, Escape dismissal and close-on-navigation; verified expanded-state changes and visible menu placement.
- Switched workflow examples in each concept and confirmed the workflow text changed.
- Expanded FAQs in each concept and confirmed the corresponding content was available.
- Selected support and larger-organisation inputs in each enquiry preview and confirmed the departmental-assessment result. Also verified the small-business sales result.
- Checked sticky-header behaviour while navigating down the page. Heading offsets leave room for the header.
- Added reduced-motion CSS, visible keyboard focus, labelled controls, an accessible skip link and a no-JavaScript content fallback. The enquiry preview's submit button is initially disabled and only enabled when its local handler is attached.
- Replaced missing diagonal-arrow font glyphs with inline SVG after visual inspection.

## Limits and production follow-up

- Responsive checks used Chromium with viewport frames, not physical iOS/Android devices. Safari and Firefox testing remains necessary before launch.
- This is not a formal WCAG audit. Verify text/non-text contrast, zoom/reflow, screen-reader announcements and keyboard journeys on the selected production implementation.
- No real forms, email delivery, CRM, booking, consent management or analytics have been connected. The enquiry preview does not collect contact details, store values or send requests.
- No production deployment, DNS change, hosting purchase or existing-server modification is part of this review.
- The working name, final brand, service scope, legal pages and factual commercial claims must be confirmed before publication.
- `noindex,nofollow` is present on drafts; it is not an access-control mechanism. Remove or revise it deliberately for the approved production website.

## Recommended next decision

Choose a primary direction and any specific elements to borrow from the others. Then implement a coherent production design in the selected platform, connect actual enquiry handling, and perform the remaining launch checks.
