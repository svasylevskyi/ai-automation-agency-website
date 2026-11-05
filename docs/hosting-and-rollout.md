# Hosting and rollout recommendation

Prepared 5 November 2026. Prices are vendor list prices checked on this date, not a quote. Tax, currency conversion, availability, usage, paid seats and optional services can change the actual cost.

## Recommendation for this agency

Use **Hetzner for the initial custom website**, keeping the future production implementation portable: Next.js, TypeScript, Tailwind CSS and MDX, with a static export where practical. Serve the exported files through your existing reverse proxy, in a separate directory/container with a dedicated hostname and release process.

This recommendation depends on your existing server having spare capacity, monitoring, backups and reliable maintenance. Its main advantage is reuse of infrastructure you already operate. If the only available server is an experimental development environment, isolate the agency website on a small production server or use Vercel instead. A marketing site should not go offline when another project's deployment fails.

Choose **Vercel Pro** if preview deployments, quick rollbacks and less server administration are worth the additional subscription. Existing applications and automation workers can stay at Hetzner; the marketing site does not need to share their hosting provider. Serving larger clients is not, by itself, a reason to change hosts.

The HTML drafts in this repository are buildless and hosting-independent. They do not yet install Next.js, connect a CRM, run automation, or provision hosting.

## Hetzner versus Vercel Pro

| Consideration | Hetzner Cloud | Vercel Pro |
| --- | --- | --- |
| Product being purchased | A virtual server you operate | A managed application/deployment platform |
| Initial cost | Incremental cost can be small on an existing adequately provisioned server. New EU CX23 list price is €5.49/month, excluding IPv4 and VAT; current availability must be checked. CPX22 is €19.49/month in the cited price schedule. | Starts at US$20/month with an included usage credit; paid seats, usage and add-ons affect the bill. Commercial usage requires Pro or Enterprise. |
| What remains your work | OS and runtime updates, firewall, TLS/reverse proxy, monitoring, releases, recovery and backups | Application quality, dependencies, secrets, access settings, integrations, data stores and usage control; infrastructure management is largely handled by the platform |
| Next.js | Static export, or a Node/Docker runtime behind a reverse proxy | Integrated Next.js deployment and platform features |
| Pull-request review | Build a preview/staging deployment process yourself | Automatic preview deployments through the Git integration |
| Releases and rollback | Versioned static releases or image tags; switch back to a known-good release | Managed deployments and rollback controls |
| Traffic and scaling | Fixed capacity; configure caching/CDN and capacity changes as necessary | Managed delivery/scaling within product limits and billing rules |
| Isolation | You design server/container boundaries and failure domains | Separate projects/environments; evaluate production settings and plan limits |
| Data location | Select a server location; still examine all connected services and subprocessors | Select supported runtime regions where applicable; examine CDN, logs, service and subprocessors separately |
| Best fit here | Familiar hosting and a simple, mostly static first release | Frequent site changes and a strong preference to minimise deployment work |

The price comparison is not a like-for-like bundle: Hetzner does not include the application platform work you perform yourself. The entry-level cost-optimised Hetzner page was showing availability restrictions when checked. Do not assume the cheapest server can be ordered in your chosen region.

Neither provider, by itself, makes the agency's whole solution compliant or enterprise-ready. That depends on the workflow, data, integrations, contracts and actual operating practices.

## Proposed custom-site stack

- **Frontend:** Next.js + TypeScript + Tailwind CSS, implemented after choosing a design.
- **Content:** MDX for service copy and early case studies. Add a visual CMS when the editing workflow warrants one.
- **Delivery:** Prefer `output: 'export'` for the initial informational site. Static export has no request-time server actions or dynamic backend routes; contact handling must use an external provider or a separate backend.
- **Hosting:** Static files served by Caddy/nginx on Hetzner. If server-side Next.js features become necessary, run a versioned Docker image behind the reverse proxy.
- **Lead capture and booking:** HubSpot forms/CRM/meeting scheduling or equivalent, with the selected account and plan limits checked before integration.
- **Automation:** n8n for internal workflows when needed, in an environment separate from the public website. Keep credentials server-side.
- **Measurement:** Plausible plus Search Console; introduce advertising tags only when the acquisition strategy needs them.
- **Source and review:** GitHub branches and PRs.

### Hetzner rollout

1. Develop on a feature branch; run appropriate validation/build checks in GitHub Actions.
2. Build an immutable static artifact or container image tagged with the commit SHA. Build off the production server where possible.
3. Deploy that artifact to a separate staging hostname. Keep drafts out of search and protect staging where appropriate; `noindex` is not access control.
4. Check mobile/desktop layouts, navigation, accessibility and real enquiry delivery using test data.
5. Use a manual production deployment job to promote the same approved artifact. Configure its deploy credentials and host verification deliberately.
6. Run a smoke check. Retain the prior artifact/image and release configuration for rollback.

No deployment credentials, server changes or production jobs are created in this design exercise.

### Vercel rollout

1. Connect the GitHub repository to a Vercel project and choose the framework/root directory.
2. Configure preview and production environment variables separately.
3. Push a branch/PR to receive a preview URL. Review and validate the preview.
4. Merge to the configured production branch to deploy, or use a deliberately configured manual promotion process.
5. Check the production release and retain rollback capability. Set spending alerts/controls and review integration-specific settings.

## What Webflow changes

For a conventional Webflow-hosted marketing site, **Webflow replaces the Next.js/TypeScript/Tailwind presentation layer, the MDX content workflow and Hetzner/Vercel website hosting**. You do not need both frontend stacks for the same marketing pages.

| Layer | Custom implementation | Webflow implementation |
| --- | --- | --- |
| Layout and styling | React components and Tailwind/CSS in Git | Webflow Designer, reusable components, classes and variables |
| Content | MDX initially | Static Webflow content; Webflow CMS for case studies/articles when needed |
| Website hosting | Hetzner or Vercel | Webflow Site hosting with a custom domain |
| Website editing | Commit, PR, preview and deploy | Edit visually, publish to staging, review, publish selected domains |
| CRM/booking | HubSpot or equivalent | Same provider, via suitable forms/embeds/integrations |
| Internal automation | n8n and any service backend | Can remain at Hetzner or n8n Cloud |
| Analytics | Plausible/Search Console | Same tools, connected in Webflow |
| GitHub's role | Website source of truth and release history | Supporting custom code, integration services, documentation and design references; not the normal source of truth for Designer changes |

At the time checked, Webflow lists **Basic at US$15/month billed yearly** for sites without CMS, and **Premium starting at US$25/month billed yearly** for CMS needs. Choose against actual bandwidth/content needs; Workspace features and optional services can add cost. Historical references to the old “CMS plan” may not match current packaging.

### Webflow rollout

1. Recreate the selected design in Webflow using reusable components and breakpoint styles. These HTML files are design references, not a promise of one-click import into editable Webflow components.
2. Add CMS collections only for content that benefits from structured editing.
3. Configure enquiry handling, booking, SEO fields, analytics and redirects as appropriate.
4. Publish only to the `webflow.io` staging subdomain; leave the production domain unchecked. Test custom code on the published staging site.
5. Review mobile and desktop behaviour and verify that enquiries arrive in the correct CRM/account.
6. Connect a custom domain with an appropriate Site plan, then explicitly publish the approved site to that domain. Subsequent visual/content changes follow the same staging-and-publish process.

Webflow staging is not equivalent to a unique preview for every GitHub PR. Additional branching/governance capabilities depend on the subscribed plan. Do not assume GitHub PR review is the publication gate for ordinary Designer edits.

### Can Webflow still be hosted at Hetzner?

Yes, by exporting static HTML/CSS/JS/assets with a qualifying **paid Workspace plan**, then committing and deploying the export. A Site plan alone does not include code export. However, the export does **not** carry the hosted CMS functionality/content bindings, native form handling, site search and several other hosted features. Replace those services and test them separately.

Edits in the exported code do not become an automatic two-way source workflow in Designer. Future exports need controlled comparison so they do not overwrite custom changes. For a solo founder, Webflow plus external hosting usually gives up much of Webflow's convenience; use Webflow hosting if visual editing is the deciding benefit.

## Single-page navigation recommendation

Use one scroll-based homepage at launch: introduction, solutions, illustrative workflows, approach (including the larger-company path), questions and contact. Six concise sections are enough for the first release.

- Keep normal browser scrolling, direct fragment links and back/forward behaviour. Avoid scroll hijacking, mandatory snapping and long pinned animation sequences.
- Use a sticky header around 64 px on mobile and 72 px on desktop, visible while scrolling. Include at least 44 px navigation/menu targets, clear keyboard focus, and anchor offsets so headings remain visible.
- Collapse to a labelled hamburger button at narrower widths. Expose expanded state, close after navigation, allow Escape and return focus to the button when dismissed with Escape.
- Use accordions for supporting FAQs, never to hide the core offer or the main contact action.
- Keep separate privacy/legal pages when production content is ready. Add dedicated service, campaign, case-study and article URLs as search marketing grows. A single homepage cannot target every distinct search intent well.
- Keep important content available without JavaScript. In these drafts, the examples and enquiry planner are enhancements; base content and links still work without scripts.

## Sources checked

- [Hetzner June 2026 price schedule](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Hetzner cost-optimised servers and availability](https://www.hetzner.com/cloud/cost-optimized/)
- [Hetzner backups and snapshots](https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/)
- [Vercel Pro](https://vercel.com/docs/plans/pro-plan)
- [Vercel pricing](https://vercel.com/pricing)
- [Vercel environments and previews](https://vercel.com/docs/deployments/environments)
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Webflow pricing](https://webflow.com/pricing)
- [Webflow staging](https://help.webflow.com/hc/en-us/articles/33961419650067-Webflow-staging-subdomain)
- [Webflow publishing](https://help.webflow.com/hc/en-us/articles/33961351954579-How-do-I-publish-or-unpublish-a-Webflow-site)
- [Webflow code export and limitations](https://help.webflow.com/hc/en-us/articles/33961386739347-How-do-I-export-my-Webflow-site-code)
