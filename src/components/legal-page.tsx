import type { Metadata } from "next";
import { getBrand } from "@/server/settings";
import { env } from "@/server/env";
import { getLegalPage } from "@/server/legal";
import {
  legalPages,
  unresolvedLegalKeys,
  resolveLegalText,
  type LegalSlug,
} from "@/lib/legal";
import { parseLegalContent } from "@/lib/legal-content";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { LegalContent } from "./legal-content";

export async function legalMetadata(slug: LegalSlug): Promise<Metadata> {
  const [brand, page] = await Promise.all([getBrand(), getLegalPage(slug)]);
  const index =
    !!brand.siteUrl &&
    !page.isDraft &&
    !unresolvedLegalKeys(page.title + "\n" + page.content, page.values).length;
  const title = resolveLegalText(page.title, page.values);
  const canonical = new URL(legalPages[slug].path, env().APP_URL).toString();
  return {
    title: `${title} | ${brand.name}`,
    description: legalPages[slug].description,
    robots: { index, follow: index },
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${brand.name}`,
      description: legalPages[slug].description,
      url: canonical,
    },
  };
}
export async function LegalDocument({ slug }: { slug: LegalSlug }) {
  const [brand, page] = await Promise.all([getBrand(), getLegalPage(slug)]);
  const draft =
    page.isDraft ||
    unresolvedLegalKeys(page.title + "\n" + page.content, page.values).length >
      0;
  const title = resolveLegalText(page.title, page.values);
  const content = resolveLegalText(page.content, page.values);
  return (
    <>
      <a className="skip" href="#legal-main">
        Skip to content
      </a>
      <SiteHeader brand={brand} />
      <main className="wrap legal-document" id="legal-main" tabIndex={-1}>
        <h1>{title}</h1>
        <p className="legal-date">
          Updated{" "}
          <time dateTime={page.updatedAt}>
            {new Date(page.updatedAt).toLocaleDateString("en-GB", {
              timeZone: "Europe/Warsaw",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>{" "}
          · Revision {page.version}
        </p>
        {draft && (
          <aside className="legal-draft" aria-label="Draft status">
            <strong>Draft for review</strong>
            <p>
              This page contains provisional wording or placeholders. Business
              details and operating arrangements still need to be completed and
              reviewed before use as a final document.
            </p>
          </aside>
        )}
        <nav className="legal-contents" aria-label="On this page">
          <strong>On this page</strong>
          <ul>
            {parseLegalContent(content).map((block, index) =>
              block.type === "heading" ? (
                <li key={index}>
                  <a href={`#legal-section-${index}`}>{block.text}</a>
                </li>
              ) : null,
            )}
          </ul>
        </nav>
        <LegalContent content={content} />
        {slug === "privacy" && (
          <p className="legal-authority">
            Data protection authority in Poland:{" "}
            <a href="https://uodo.gov.pl">UODO</a>.
          </p>
        )}
      </main>
      <SiteFooter brand={brand} />
    </>
  );
}
