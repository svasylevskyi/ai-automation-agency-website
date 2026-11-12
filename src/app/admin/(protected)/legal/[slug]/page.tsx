import { notFound } from "next/navigation";
import { LegalEditor } from "@/components/legal-editor";
import { legalSlugSchema, legalPages } from "@/lib/legal";
import { getLegalPage } from "@/server/legal";
import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/owner-page";

export default async function LegalDocument({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireOwner();
  const slug = legalSlugSchema.safeParse((await params).slug);
  if (!slug.success) notFound();
  const [page, settings] = await Promise.all([
    getLegalPage(slug.data),
    slug.data === "privacy" ? getSettings() : Promise.resolve(null),
  ]);
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Legal docs</div>
          <h1>{legalPages[slug.data].title}</h1>
          <p>Review the wording and publication status of this document.</p>
        </div>
      </div>
      <div className="legal-editors">
        <LegalEditor
          key={slug.data}
          initial={page}
          privacyOverride={!!settings?.settings.privacyUrl}
        />
      </div>
    </>
  );
}
