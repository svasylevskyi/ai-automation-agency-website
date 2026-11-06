"""Exercise backup orchestration with isolated files and deterministic host/storage substitutes."""
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parents[2]
spec = importlib.util.spec_from_file_location("agency_offsite", ROOT / "deploy/offsite.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class FakeBackup(module.Backup):
    def __init__(self, root):
        paths = module.Paths(root / "state", root / "local", root / "site.env", root / "status/status.json", root / "cache")
        for path in (paths.state, paths.local, paths.status.parent, paths.cache):
            path.mkdir()
        paths.site.write_text("DATABASE_URL=secret-test-value")
        config = dict(RESTIC_REPOSITORY="fake", RESTIC_PASSWORD_FILE="fake", AWS_ACCESS_KEY_ID="fake", AWS_SECRET_ACCESS_KEY="fake", BACKUP_DAYS=35, CHECKPOINT_DAYS=65, LOCAL_DAYS=7)
        super().__init__(config, paths)
        self.repository = "a" * 64
        (paths.state / "repository-id").write_text(self.repository)
        self.commands, self.data, self.saved = [], {}, []
        self.fail, self.corrupt, self.created = None, False, []

    def restic(self, *args, output=None):
        self.commands.append(args)
        if self.fail and self.fail == args[0]:
            raise module.Failure("Simulated storage failure")
        if args[:2] == ("cat", "config"):
            return json.dumps({"id": self.repository}).encode()
        if args[0] == "backup":
            path, tag = Path(args[-1]), args[args.index("--tag") + 1]
            identity = hashlib.sha256(str(len(self.saved)).encode()).hexdigest()
            self.data[identity] = {str(file): file.read_bytes() for file in path.iterdir() if file.is_file()}
            self.saved.append(dict(id=identity, time=module.iso(), hostname=module.HOST, tags=[tag]))
            return json.dumps(dict(message_type="summary", snapshot_id=identity)).encode()
        if args[0] == "dump":
            value = self.data[args[1]][args[2]]
            if self.corrupt:
                value += b"corrupt"
            output.write(value)
            return b""
        if args[0] == "snapshots":
            tag = args[args.index("--tag") + 1] if "--tag" in args else None
            return json.dumps([row for row in self.saved if tag is None or tag in row["tags"]]).encode()
        return b""

    def pg(self, *args, data=None, input_path=None, output=None):
        self.commands.append(args)
        if self.fail and self.fail == args[0]:
            raise module.Failure("Simulated database failure")
        if args[0] == "/usr/local/sbin/agency-backup":
            (self.paths.local / (module.now().strftime("agency-%Y%m%dT%H%M%SZ-") + "1.dump")).write_bytes(b"PGDMP-private-test-records")
        if args[0] == "psql" and output:
            output.write((json.dumps({"id": "10000000-0000-4000-8000-000000000000", "deleted_at": module.iso()}) + "\n").encode())
        if args[0] == "createdb":
            self.created.append(args[-1])
        return b""

    def sql(self, statement, database="agency"):
        self.commands.append(("sql", database, statement))
        if "json_build_object('enquiries'" in statement:
            return json.dumps(dict(enquiries=1, settings=1, legal_pages=2, owners=1, policy=1, orphan_activity=0)).encode()
        return b""


class OffsiteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.backup = FakeBackup(Path(self.temp.name))

    def test_backup_round_trip_and_cleanup(self):
        self.backup.backup()
        self.assertEqual(len(self.backup.saved), 2)
        status = json.loads(self.backup.paths.status.read_text())
        self.assertIn("lastBackupAt", status)
        self.assertIn("lastCheckpointAt", status)
        self.assertFalse(self.backup.stage.exists())
        full = self.backup.data[next(s["id"] for s in self.backup.saved if module.FULL in s["tags"])]
        self.assertIn(str(self.backup.stage / "site.env"), full)
        self.assertNotIn("restic.password", " ".join(full))

    def test_failed_upload_or_checksum_never_prunes(self):
        for failure, corrupt in [("backup", False), (None, True)]:
            self.backup.fail, self.backup.corrupt = failure, corrupt
            with self.assertRaises(module.Failure):
                self.backup.backup()
            self.assertFalse(any(command[0] == "forget" for command in self.backup.commands))
            self.assertFalse(self.backup.stage.exists())
            self.assertFalse(self.backup.checkpoint_dir.exists())

    def test_repository_identity_is_pinned(self):
        self.backup.repository = "b" * 64
        with self.assertRaises(module.Failure):
            self.backup.backup()
        self.assertFalse(self.backup.saved)

    def test_restore_uses_new_database_and_reapplies_deletions(self):
        self.backup.backup()
        self.backup.verify()
        database = self.backup.created[0]
        self.assertRegex(database, r"^agency_restore_[0-9a-f]{16}$")
        commands = self.backup.commands
        restore = next(c for c in commands if c[0] == "pg_restore")
        self.assertIn("--role=agency_restore_check", restore)
        self.assertIn("--no-owner", restore)
        self.assertTrue(any(c[0] == "sql" and c[1] == database and "DELETE FROM enquiries" in c[2] for c in commands))
        self.assertTrue(any(c[0] == "dropdb" and c[-1] == database for c in commands))
        self.assertFalse(any(c[0] == "pg_restore" and "--dbname=agency" in c for c in commands))
        self.assertFalse(list(self.backup.paths.state.glob("restore-*")))

    def test_recovery_preparation_keeps_only_successful_isolated_copy(self):
        self.backup.backup()
        self.backup.verify(keep=True)
        self.assertTrue(list(self.backup.paths.state.glob("restore-*")))
        self.assertFalse(any(c[0] == "dropdb" for c in self.backup.commands))
        self.assertNotIn("lastVerifiedAt", json.loads(self.backup.paths.status.read_text()))

    def test_failed_restore_drops_temporary_database_and_keeps_live_untouched(self):
        self.backup.backup()
        self.backup.fail = "pg_restore"
        with self.assertRaises(module.Failure):
            self.backup.verify()
        self.assertTrue(any(c[0] == "dropdb" for c in self.backup.commands))
        self.assertNotIn("lastVerifiedAt", json.loads(self.backup.paths.status.read_text()))
        self.assertFalse(list(self.backup.paths.state.glob("restore-*")))

    def test_pruning_requires_recent_restore_and_backup(self):
        self.backup.backup()
        with self.assertRaises(module.Failure):
            self.backup.prune()
        self.backup.report(lastVerifiedAt=module.iso(module.now() - dt.timedelta(days=15)))
        with self.assertRaises(module.Failure):
            self.backup.prune()
        self.assertFalse(any(c[0] == "forget" for c in self.backup.commands))

    def test_pruning_is_scoped_and_preserves_newest_local_and_unknown_files(self):
        self.backup.backup()
        self.backup.verify()
        old = self.backup.paths.local / "agency-20200101T000000-1.dump"
        old.write_bytes(b"old")
        unknown = self.backup.paths.local / "manual-copy.dump"
        unknown.write_bytes(b"unmanaged")
        with self.assertRaisesRegex(module.Failure, "Unmanaged"):
            self.backup.prune()
        self.assertFalse(any(c[0] == "sql" and "DELETE FROM enquiry_deletions" in c[2] for c in self.backup.commands))
        unknown.unlink()
        self.backup.prune()
        self.assertFalse(old.exists())
        self.assertFalse(unknown.exists())
        self.assertEqual(len(self.backup.local_dumps()), 1)
        forget = [c for c in self.backup.commands if c[0] == "forget"]
        self.assertEqual(len(forget), 4)
        self.assertIn("35d", forget[0])
        self.assertIn("65d", forget[1])
        self.assertIn("--keep-last", forget[0])
        self.assertIn("--host", forget[0])
        self.assertTrue(any(c[0] == "sql" and "DELETE FROM enquiry_deletions" in c[2] for c in self.backup.commands))

    def test_operation_errors_are_not_cleared_by_other_job_success(self):
        self.backup.report(outcome=("backup", True))
        self.backup.report(outcome=("checkpoint", False))
        self.assertIn("backup", json.loads(self.backup.paths.status.read_text())["failures"])
        self.backup.report(outcome=("backup", False))
        self.assertEqual(json.loads(self.backup.paths.status.read_text())["failures"], {})

    def test_configuration_does_not_execute_shell_and_rejects_wrong_repository(self):
        path = Path(self.temp.name) / "config"
        path.write_text("RESTIC_REPOSITORY=$(touch /tmp/should-not-exist)\n")
        path.chmod(0o600)
        with self.assertRaises(module.Failure):
            module.load_config(path)
        path.write_text("RESTIC_REPOSITORY=s3:https://wrong.example/bucket/agency\nRESTIC_PASSWORD_FILE=/etc/agency/restic.password\nAWS_ACCESS_KEY_ID=x\nAWS_SECRET_ACCESS_KEY=y\n")
        with self.assertRaises(module.Failure):
            module.load_config(path)
        path.chmod(0o644)
        with self.assertRaises(module.Failure):
            module.load_config(path)


if __name__ == "__main__":
    unittest.main()
