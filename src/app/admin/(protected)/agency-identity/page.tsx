import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/owner-page";
import { SettingsForm } from "@/components/admin-forms";

export default async function AgencyIdentity() {
  await requireOwner();
  const { settings, version } = await getSettings();
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Agency identity</h1>
          <p>Keep the public details current without a code change.</p>
        </div>
      </div>
      <SettingsForm initial={settings} version={version} />
    </>
  );
}
