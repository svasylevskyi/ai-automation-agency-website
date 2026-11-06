import { getLegalPage } from "@/server/legal";
import { LegalEditor } from "@/components/legal-editor";
import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/owner-page";
import { SettingsForm } from "@/components/admin-forms";
export default async function Settings() {
  await requireOwner();
  const [{ settings, version }, privacy, terms] = await Promise.all([
    getSettings(),
    getLegalPage("privacy"),
    getLegalPage("terms"),
  ]);
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Your agency, your identity</div>
          <h1>Website settings</h1>
          <p>Keep the public details current without a code change.</p>
        </div>
      </div>
      <SettingsForm initial={settings} version={version} />
      <div className="legal-editors">
        <LegalEditor
          initial={privacy}
          privacyOverride={!!settings.privacyUrl}
        />
        <LegalEditor initial={terms} />
      </div>
    </>
  );
}
