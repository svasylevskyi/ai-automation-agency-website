#!/usr/bin/env python3
"""Root-owned Restic/R2 backup tooling. Never imports or executes application code."""
import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass

UTC = dt.timezone.utc
HOST = "agency-website"
FULL = "agency-full"
LEDGER = "agency-deletions"
HEX = re.compile(r"^[0-9a-f]{64}$")
DUMP = re.compile(r"^agency-(\d{8}T\d{6})Z?-\d+\.dump$")


class Failure(Exception):
    pass


def now():
    return dt.datetime.now(UTC)


def iso(value=None):
    return (value or now()).isoformat().replace("+00:00", "Z")


def instant(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def private_file(path):
    stat = path.lstat()
    if not path.is_file() or path.is_symlink() or stat.st_uid != os.geteuid() or stat.st_mode & 0o077:
        raise Failure("Configuration and password files must be owner-only regular files.")


def load_config(path):
    private_file(path)
    values = {}
    allowed = {"RESTIC_REPOSITORY", "RESTIC_PASSWORD_FILE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BACKUP_DAYS", "CHECKPOINT_DAYS", "LOCAL_DAYS"}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, raw = line.partition("=")
        parts = shlex.split(raw, comments=True)
        if not separator or key not in allowed or key in values or len(parts) != 1:
            raise Failure("Invalid backup configuration entry.")
        values[key] = parts[0]
    for key in ("RESTIC_REPOSITORY", "RESTIC_PASSWORD_FILE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
        if not values.get(key):
            raise Failure("Backup configuration is incomplete.")
    if not re.fullmatch(r"s3:https://[a-f0-9]{32}\.eu\.r2\.cloudflarestorage\.com/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]/agency", values["RESTIC_REPOSITORY"]):
        raise Failure("Use the EU R2 endpoint, a dedicated bucket and the /agency repository prefix.")
    if values["RESTIC_PASSWORD_FILE"] != "/etc/agency/restic.password":
        raise Failure("Use /etc/agency/restic.password for the encryption password.")
    private_file(Path(values["RESTIC_PASSWORD_FILE"]))
    if len(Path(values["RESTIC_PASSWORD_FILE"]).read_text().strip()) < 32:
        raise Failure("Use a dedicated encryption password of at least 32 characters.")
    for key, default in (("BACKUP_DAYS", 35), ("CHECKPOINT_DAYS", 65), ("LOCAL_DAYS", 7)):
        try:
            values[key] = int(values.get(key, default))
        except ValueError as error:
            raise Failure("Retention periods must be whole days.") from error
    if not 7 <= values["BACKUP_DAYS"] <= 3650 or not values["BACKUP_DAYS"] + 30 <= values["CHECKPOINT_DAYS"] <= 7300 or not 1 <= values["LOCAL_DAYS"] <= values["BACKUP_DAYS"]:
        raise Failure("Require 7–3650 backup days, at least 30 extra checkpoint days, and 1–backup-days local days.")
    return values


@dataclass
class Paths:
    state: Path = Path("/var/lib/agency-backup")
    local: Path = Path("/var/lib/postgresql/agency-backups")
    site: Path = Path("/etc/agency/site.env")
    status: Path = Path("/var/lib/agency-backup-status/status.json")
    cache: Path = Path("/var/cache/agency-backup")


class Backup:
    def __init__(self, config, paths=None):
        self.config = config
        self.paths = paths or Paths()
        self.stage = self.paths.state / "staging"
        self.checkpoint_dir = self.paths.state / "checkpoint"
        self.env = {"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"}
        self.restic_env = {**self.env, **{key: str(config[key]) for key in ("RESTIC_REPOSITORY", "RESTIC_PASSWORD_FILE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")}, "AWS_DEFAULT_REGION": "auto", "RESTIC_CACHE_DIR": str(self.paths.cache)}

    def run(self, command, *, data=None, input_path=None, output=None, env=None):
        try:
            with (input_path.open("rb") if input_path else contextlib.nullcontext(None)) as source:
                result = subprocess.run(command, input=data, stdin=source, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, env=env or self.env, check=True, timeout=7200)
            return result.stdout or b""
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
            # Raw subprocess output can contain secrets or restored data. Keep it out of logs.
            raise Failure(f"{Path(command[0]).name} operation failed; inspect configuration and service permissions.") from error

    def restic(self, *args, output=None):
        return self.run(["restic", *args], output=output, env=self.restic_env)

    def pg(self, *args, data=None, input_path=None, output=None):
        return self.run(["runuser", "-u", "postgres", "--", *args], data=data, input_path=input_path, output=output)

    def sql(self, statement, database="agency"):
        return self.pg("psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "--dbname=" + database, "-c", statement)

    def report(self, **fields):
        try:
            state = json.loads(self.paths.status.read_text())
        except (FileNotFoundError, ValueError):
            state = {}
        outcome = fields.pop("outcome", None)
        if outcome:
            action, failed = outcome
            errors = state.get("failures", {})
            if failed:
                errors[action] = iso()
            else:
                errors.pop(action, None)
            state["failures"] = errors
        state.update(fields)
        tmp = self.paths.status.with_suffix(".tmp")
        tmp.write_text(json.dumps(state))
        os.chmod(tmp, 0o640)
        # The status directory has the agency group; retain it on atomic replacement.
        os.chown(tmp, -1, self.paths.status.parent.stat().st_gid)
        tmp.replace(self.paths.status)

    def repository_id(self):
        value = json.loads(self.restic("cat", "config"))["id"]
        if not HEX.fullmatch(value):
            raise Failure("Invalid repository identity.")
        return value

    def ensure_repository(self):
        pinned = (self.paths.state / "repository-id").read_text().strip()
        if pinned != self.repository_id():
            raise Failure("Repository identity differs from the pinned agency repository.")

    def init(self):
        pin = self.paths.state / "repository-id"
        if pin.exists():
            raise Failure("Repository is already pinned. Initialization is not repeated.")
        self.restic("init", "--repository-version", "2")
        value = self.repository_id()
        pin.write_text(value + "\n")
        print("Repository initialized. Save this non-secret repository ID with your recovery records: " + value)

    def pin(self, expected):
        if not HEX.fullmatch(expected or "") or self.repository_id() != expected:
            raise Failure("The supplied recovery repository ID does not match.")
        pin = self.paths.state / "repository-id"
        if pin.exists():
            raise Failure("A repository is already pinned on this server.")
        pin.write_text(expected + "\n")

    def snapshots(self, tag=None):
        args = ["snapshots", "--json"]
        if tag:
            args += ["--host", HOST, "--tag", tag]
        values = json.loads(self.restic(*args)) or []
        for value in values:
            if not HEX.fullmatch(value["id"]):
                raise Failure("Invalid snapshot identity.")
        return values

    def latest(self, tag, selected=None):
        snapshots = self.snapshots(tag)
        if selected:
            snapshots = [value for value in snapshots if value["id"] == selected]
        if not snapshots:
            raise Failure("No matching snapshot exists in the agency repository.")
        return max(snapshots, key=lambda value: instant(value["time"]))

    def upload(self, path, tag):
        result = self.restic("backup", "--json", "--host", HOST, "--tag", tag, str(path))
        summaries = [json.loads(line) for line in result.splitlines() if line.strip()]
        snapshot = next((line.get("snapshot_id") for line in reversed(summaries) if line.get("message_type") == "summary"), None)
        if not snapshot or not HEX.fullmatch(snapshot):
            raise Failure("Restic did not confirm a completed snapshot.")
        return snapshot

    def download(self, snapshot, source, target):
        with target.open("wb") as stream:
            self.restic("dump", snapshot, str(source), output=stream)

    def checkpoint(self):
        self.ensure_repository()
        shutil.rmtree(self.checkpoint_dir, ignore_errors=True)
        self.checkpoint_dir.mkdir(mode=0o700)
        ledger = self.checkpoint_dir / "deletions.jsonl"
        try:
            with ledger.open("wb") as stream:
                self.pg("psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "--dbname=agency", "-c", "SELECT json_build_object('id',enquiry_id,'deleted_at',deleted_at) FROM enquiry_deletions ORDER BY enquiry_id", output=stream)
            snapshot = self.upload(self.checkpoint_dir, LEDGER)
            verified = self.checkpoint_dir / "download-check"
            self.download(snapshot, ledger, verified)
            if digest(ledger) != digest(verified):
                raise Failure("Deletion-checkpoint round-trip verification failed.")
            self.report(lastCheckpointAt=iso())
            return snapshot
        finally:
            shutil.rmtree(self.checkpoint_dir, ignore_errors=True)

    def local_dumps(self):
        values = []
        for file in self.paths.local.iterdir():
            match = DUMP.fullmatch(file.name)
            if match and file.is_file() and not file.is_symlink():
                started = dt.datetime.strptime(match[1], "%Y%m%dT%H%M%S").replace(tzinfo=UTC)
                values.append((started, file))
        return sorted(values)

    def backup(self):
        self.ensure_repository()
        shutil.rmtree(self.stage, ignore_errors=True)
        self.stage.mkdir(mode=0o700)
        try:
            before = {path.name for _, path in self.local_dumps()}
            self.pg("/usr/local/sbin/agency-backup")
            fresh = [(time, path) for time, path in self.local_dumps() if path.name not in before]
            if not fresh:
                raise Failure("A fresh database dump was not created.")
            dump = self.stage / "agency.dump"
            shutil.copyfile(fresh[-1][1], dump)
            if not self.paths.site.is_file() or self.paths.site.is_symlink():
                raise Failure("The runtime environment file is missing or is a symlink.")
            shutil.copyfile(self.paths.site, self.stage / "site.env")
            manifest = {"version": 1, "created_at": iso(), "dump_sha256": digest(dump), "site_sha256": digest(self.stage / "site.env")}
            (self.stage / "manifest.json").write_text(json.dumps(manifest))
            snapshot = self.upload(self.stage, FULL)
            self.restic("check")
            checked = self.stage / "download-check.dump"
            self.download(snapshot, dump, checked)
            if digest(checked) != manifest["dump_sha256"]:
                raise Failure("Database-backup round-trip verification failed.")
            self.checkpoint()
            self.report(lastBackupAt=iso())
        finally:
            shutil.rmtree(self.stage, ignore_errors=True)
        # Retention is a separate command, never a side effect of the first backup.
        print("Encrypted backup uploaded and downloaded checksum verified.")

    def verify(self, selected=None, keep=False):
        self.ensure_repository()
        full = self.latest(FULL, selected)
        checkpoint = self.latest(LEDGER)
        self.restic("check", "--read-data")
        directory = Path(tempfile.mkdtemp(prefix="restore-", dir=self.paths.state))
        database = "agency_restore_" + os.urandom(8).hex()
        created = False
        success = False
        try:
            for name in ("agency.dump", "manifest.json", "site.env"):
                self.download(full["id"], self.stage / name, directory / name)
            self.download(checkpoint["id"], self.checkpoint_dir / "deletions.jsonl", directory / "deletions.jsonl")
            manifest = json.loads((directory / "manifest.json").read_text())
            if manifest.get("version") != 1 or digest(directory / "agency.dump") != manifest["dump_sha256"] or digest(directory / "site.env") != manifest["site_sha256"]:
                raise Failure("Restored file checksums failed.")
            # Pipe the archive to avoid making the secret staging directory readable by postgres.
            self.pg("createdb", "--template=template0", "--owner=agency_restore_check", database)
            created = True
            self.sql(f'REVOKE CONNECT ON DATABASE "{database}" FROM PUBLIC', "postgres")
            # A dedicated non-superuser role owns all restored objects. The live DB is never targeted.
            self.pg("pg_restore", "--exit-on-error", "--no-owner", "--no-privileges", "--role=agency_restore_check", "--dbname=" + database, input_path=directory / "agency.dump")
            records = []
            for line in (directory / "deletions.jsonl").read_text().splitlines():
                record = json.loads(line)
                if not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", record["id"]):
                    raise Failure("Invalid deletion checkpoint.")
                records.append((record["id"], iso(instant(record["deleted_at"]))))
            # Preserve the ENTIRE checkpoint for later backups, including IDs absent from this older dump.
            # UUIDs are validated and timestamps normalized above; no enquiry content becomes SQL.
            for start in range(0, len(records), 500):
                batch = records[start:start + 500]
                literals = ",".join("'" + identity + "'" for identity, _ in batch)
                values = ",".join("('" + identity + "','" + timestamp + "'::timestamptz)" for identity, timestamp in batch)
                self.sql("SET ROLE agency_restore_check; SET row_security=off; INSERT INTO enquiry_deletions(enquiry_id,deleted_at) VALUES " + values + " ON CONFLICT(enquiry_id) DO UPDATE SET deleted_at=GREATEST(enquiry_deletions.deleted_at,EXCLUDED.deleted_at); DELETE FROM enquiries WHERE id IN (" + literals + ")", database)
            counts = json.loads(self.sql("SET ROLE agency_restore_check; SET row_security=off; SELECT json_build_object('enquiries',(SELECT count(*) FROM enquiries),'settings',(SELECT count(*) FROM site_settings),'legal_pages',(SELECT count(*) FROM legal_pages),'owners',(SELECT count(*) FROM site_owner),'policy',(SELECT count(*) FROM retention_policy),'orphan_activity',(SELECT count(*) FROM enquiry_activity a LEFT JOIN enquiries e ON a.enquiry_id=e.id WHERE e.id IS NULL))", database).decode().splitlines()[-1])
            if counts["settings"] != 1 or counts["legal_pages"] != 2 or counts["policy"] != 1 or counts["owners"] > 1 or counts["orphan_activity"]:
                raise Failure("Restored application data checks failed.")
            # Disable destructive/background behavior in the restored copy even though no app is started.
            self.sql("SET ROLE agency_restore_check; SET row_security=off; UPDATE retention_policy SET enabled=false; DELETE FROM session", database)

            success = True
        finally:
            try:
                if created and not (keep and success):
                    self.pg("dropdb", "--if-exists", database)
            finally:
                if not (keep and success):
                    shutil.rmtree(directory, ignore_errors=True)
        if keep:
            print("Recovery prepared; live database unchanged. Isolated database: " + database + "; private files: " + str(directory))
        else:
            self.report(lastVerifiedAt=iso())
            print("Isolated restore verified and removed.")
        print("Snapshot: " + full["id"] + "; checkpoint: " + checkpoint["id"] + "; checkpoint time: " + checkpoint["time"])

    def prune(self):
        self.ensure_repository()
        report = json.loads(self.paths.status.read_text())
        if not report.get("lastVerifiedAt") or instant(report["lastVerifiedAt"]) < now() - dt.timedelta(days=14):
            raise Failure("Run a successful restore verification before pruning (required within 14 days).")
        if not report.get("lastBackupAt") or instant(report["lastBackupAt"]) < now() - dt.timedelta(hours=36):
            raise Failure("A verified recent backup is required before pruning.")
        self.checkpoint()
        self.restic("check")
        for tag, days in ((FULL, self.config["BACKUP_DAYS"]), (LEDGER, self.config["CHECKPOINT_DAYS"])):
            self.restic("forget", "--host", HOST, "--tag", tag, "--group-by", "host,tags", "--keep-within", str(days) + "d", "--keep-last", "1", "--prune")
        self.restic("check")
        dumps = self.local_dumps()
        # Never remove the newest local dump, unknown files or partial downloads.
        for timestamp, path in dumps[:-1]:
            if timestamp < now() - dt.timedelta(days=self.config["LOCAL_DAYS"]):
                path.unlink()
        snapshots = self.snapshots()
        remaining = self.local_dumps()
        if not snapshots or not remaining:
            raise Failure("Retained backup inventory is incomplete; deletion markers were preserved.")
        managed = {path for _, path in remaining}
        if any(path not in managed for path in self.paths.local.glob("*.dump")):
            raise Failure("Unmanaged local dumps exist; deletion markers were preserved. Review manual copies before pruning markers.")
        # Use ALL repository snapshots conservatively, plus every managed local dump.
        floor = min([instant(value["time"]) for value in snapshots] + [value[0] for value in remaining] + [now() - dt.timedelta(days=self.config["CHECKPOINT_DAYS"])]) - dt.timedelta(days=1)
        self.sql("DELETE FROM enquiry_deletions WHERE deleted_at < '" + iso(floor) + "'::timestamptz")
        self.report(lastPrunedAt=iso())
        print("Restic and local retention applied. Recovery markers preserved until all managed older backups expire.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init", "pin", "backup", "checkpoint", "verify", "recover", "prune"])
    parser.add_argument("--repository-id")
    parser.add_argument("--snapshot")
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("Run this installed helper with sudo.")
    os.umask(0o077)
    backup = None
    try:
        config = load_config(Path("/etc/agency/restic.env"))
        backup = Backup(config)
        with (backup.paths.state / "operation.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            if args.action == "pin":
                backup.pin(args.repository_id)
            elif args.action in ("verify", "recover"):
                if args.snapshot and not HEX.fullmatch(args.snapshot):
                    raise Failure("Use a full 64-character snapshot ID.")
                backup.verify(args.snapshot, keep=args.action == "recover")
            else:
                getattr(backup, args.action)()
            backup.report(outcome=(args.action, False))
    except (Failure, OSError, ValueError, KeyError) as error:
        if backup:
            backup.report(outcome=(args.action, True))
        # Exception strings from config parsing can include secrets; use a fixed failure summary.
        detail = str(error) if isinstance(error, Failure) else "Check the configured files, repository access and prerequisites."
        print("Agency " + args.action + " failed. " + detail + " No live database restore was performed.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
