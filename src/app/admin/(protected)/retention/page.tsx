import { requireOwner } from "@/server/owner-page";
import { getRetentionPolicy } from "@/server/retention";
import { getBackupStatus } from "@/server/backup-status";
import { RetentionEditor } from "@/components/retention-editor";
export default async function RetentionPage() {
  await requireOwner();
  const [policy, backup] = await Promise.all([
    getRetentionPolicy(),
    getBackupStatus(),
  ]);
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/Warsaw" }) +
        " (Warsaw)"
      : "Not recorded";
  const stale =
    !backup?.lastBackupAt ||
    Date.now() - new Date(backup.lastBackupAt).getTime() > 36 * 3600000;
  const checkpointStale =
    !backup?.lastCheckpointAt ||
    Date.now() - new Date(backup.lastCheckpointAt).getTime() > 2 * 3600000;
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Retention & backups</h1>
          <p>
            Decide when closed conversations expire and check the latest
            recovery results.
          </p>
        </div>
      </div>
      <RetentionEditor initial={policy} />
      <section
        className="admin-card backup-status"
        aria-labelledby="backup-title"
      >
        <h2 id="backup-title">Off-server recovery</h2>
        {!backup && (
          <p>
            No off-server backup status is available. Complete the R2 setup on
            the server before relying on off-server recovery.
          </p>
        )}
        {backup && (
          <>
            {(Object.keys(backup.failures ?? {}).length ||
              stale ||
              checkpointStale ||
              !backup.lastVerifiedAt ||
              Date.now() - new Date(backup.lastVerifiedAt).getTime() >
                8 * 86400000) && (
              <p className="notice error">
                Server attention needed:{" "}
                {Object.keys(backup.failures ?? {}).length
                  ? `operations needing review: ${Object.keys(backup.failures ?? {}).join(", ")}`
                  : "a backup, deletion checkpoint or restore check is missing or overdue"}
                . Inspect the systemd service status on the server.
              </p>
            )}
            <dl className="enquiry-facts">
              <dt>Backup verified</dt>
              <dd>{date(backup.lastBackupAt)}</dd>
              <dt>Deletion checkpoint</dt>
              <dd>{date(backup.lastCheckpointAt)}</dd>
              <dt>Restore test</dt>
              <dd>{date(backup.lastVerifiedAt)}</dd>
              <dt>Retention applied</dt>
              <dd>{date(backup.lastPrunedAt)}</dd>
            </dl>
          </>
        )}
        <p className="privacy-note">
          These are the last successful server reports, not a live check of
          Cloudflare. Credentials and encryption keys stay on the server.
          Backups are kept separately from enquiry retention; no restoration can
          replace the live database from this page.
        </p>
      </section>
    </>
  );
}
