import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/owner-page";
import { SettingsForm } from "@/components/admin-forms";
export default async function Settings() {
  await requireOwner();
  const { settings, version } = await getSettings();
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
    </>
  );
}
