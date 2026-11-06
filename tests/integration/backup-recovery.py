#!/usr/bin/env python3
"""Real encrypted Restic round trip against CI's disposable PostgreSQL service."""
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.parse import urlparse
import uuid

ROOT = Path(__file__).parents[2]
spec = importlib.util.spec_from_file_location("agency_offsite_integration", ROOT / "deploy/offsite.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
container = os.environ.get("POSTGRES_CONTAINER_ID", "")
database = urlparse(os.environ.get("DATABASE_URL", "")).path.removeprefix("/")
if not re.fullmatch(r"[a-f0-9]{12,64}", container) or database != "agency_test":
    sys.exit("Run only against the CI PostgreSQL container and agency_test database.")
deleted, kept, absent = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())


class LiveBackup(module.Backup):
    verified_deleted = False

    def pg(self, *args, data=None, input_path=None, output=None):
        if args[0] == "/usr/local/sbin/agency-backup":
            path = self.paths.local / (module.now().strftime("agency-%Y%m%dT%H%M%SZ-") + str(time.time_ns()) + ".dump")
            with path.open("wb") as target:
                return self.pg("pg_dump", "-Fc", "--dbname=agency", output=target)
        if args[0] == "dropdb":
            # Inspect the real isolated database before the production helper removes it.
            result = json.loads(self.sql(f"SELECT json_build_object('deleted',(SELECT count(*) FROM enquiries WHERE id='{deleted}'),'kept',(SELECT count(*) FROM enquiries WHERE id='{kept}'),'evidence',(SELECT count(*) FROM enquiry_deletions WHERE enquiry_id='{absent}'),'sessions',(SELECT count(*) FROM session),'enabled',(SELECT enabled FROM retention_policy))", args[-1]))
            assert result == dict(deleted=0, kept=1, evidence=1, sessions=0, enabled=False), result
            self.verified_deleted = True
        command = ["--dbname=" + database if arg == "--dbname=agency" else arg for arg in args]
        return self.run(["docker", "exec", "-i", container, command[0], "-U", "agency", *command[1:]], data=data, input_path=input_path, output=output)


os.umask(0o077)
with tempfile.TemporaryDirectory(prefix="agency-recovery-test-") as temp:
    root = Path(temp)
    paths = module.Paths(root / "state", root / "local", root / "site.env", root / "status/status.json", root / "cache")
    for path in (paths.state, paths.local, paths.status.parent, paths.cache):
        path.mkdir()
    paths.site.write_text("TEST_SECRET=encrypted-runtime-config\n")
    password = root / "restic.password"
    password.write_text(os.urandom(48).hex())
    backup = LiveBackup(dict(RESTIC_REPOSITORY=str(root / "repository"), RESTIC_PASSWORD_FILE=str(password), AWS_ACCESS_KEY_ID="unused", AWS_SECRET_ACCESS_KEY="unused", BACKUP_DAYS=35, CHECKPOINT_DAYS=65, LOCAL_DAYS=7), paths)
    backup.sql("CREATE ROLE agency_restore_check NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS", "postgres")
    for identity in (deleted, kept):
        backup.sql(f"INSERT INTO enquiries(id,submission_id,name,email,area,team_size,message,privacy_notice_version,notification_status) VALUES ('{identity}','{uuid.uuid4()}','Recovery test','recovery@example.test','sales','small','Private restore fixture','test','sent')")
    backup.init()
    backup.backup()
    backup.sql(f"DELETE FROM enquiries WHERE id='{deleted}'")
    backup.sql(f"INSERT INTO enquiry_deletions(enquiry_id) VALUES ('{absent}')")
    before = backup.sql("SELECT row_to_json(e) FROM enquiries e ORDER BY id")
    backup.checkpoint()
    backup.verify()
    assert backup.verified_deleted, "Restore was not checked against the newer deletion checkpoint"
    assert before == backup.sql("SELECT row_to_json(e) FROM enquiries e ORDER BY id"), "Live enquiries were changed by recovery verification"
    assert backup.sql("SELECT count(*) FROM pg_database WHERE datname LIKE 'agency_restore_%'", "postgres").strip() == b"0", "Restore database was not removed"
    backup.prune()
    snapshots = backup.snapshots(module.FULL)
    files = backup.restic("ls", snapshots[-1]["id"])
    assert b"site.env" in files and b"restic.password" not in files
    password.write_text("incorrect-encryption-password" * 2)
    try:
        backup.ensure_repository()
    except module.Failure:
        pass
    else:
        raise AssertionError("Repository opened with an incorrect encryption password")
    print("Real Restic/PostgreSQL recovery passed: encrypted round trip, deletion replay, isolated restore, live-data preservation, pruning and wrong-password rejection.")
