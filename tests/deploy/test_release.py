"""Exercise the real release orchestrator with isolated paths and fake host services."""
import hashlib
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

REPO = Path(__file__).parents[2].resolve()
COMMIT = 'a' * 40
NEW = COMMIT + '-2-1'
OLD = 'b' * 40 + '-1-1'


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'agency'
        self.bin = self.base / 'bin'
        for directory in [self.root / 'releases', self.root / 'incoming', self.root / 'work', self.base / 'cache', self.bin]:
            directory.mkdir(parents=True)
        self.config = self.base / 'site.env'
        self.config.write_text('NODE_ENV=production\n')
        self.log = self.base / 'calls'
        self.log.touch()
        self.env = {**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}', 'TEST_ROOT': str(self.root), 'TEST_LOG': str(self.log), 'TEST_RELEASE': NEW, 'FAIL_STAGE': ''}
        self.command('id', 'echo agency-deploy')
        self.command('chgrp', 'exit 0')
        self.command('sleep', 'exit 0')
        self.command('npm', 'echo npm >> "$TEST_LOG"')
        self.command('node', 'echo migration >> "$TEST_LOG"; [[ "$FAIL_STAGE" != migration ]]')
        self.command('sudo', '''echo "sudo $*" >> "$TEST_LOG"
if [[ "$*" == *agency-backup && "$FAIL_STAGE" == backup ]]; then exit 1; fi
exit 0''')
        self.command('curl', '''if [[ "$FAIL_STAGE" == health ]]; then echo '{"status":"ok","release":"wrong-release"}'; else printf '{"status":"ok","release":"%s"}' "$TEST_RELEASE"; fi''')
        script = (REPO / 'deploy/release.sh').read_text()
        script = script.replace('root=/srv/agency', f'root={self.root}')
        script = script.replace('/etc/agency/site.env', str(self.config))
        script = script.replace('^/srv/agency/releases/', f'^{self.root}/releases/')
        script = script.replace('/usr/local/lib/agency-validate-archive.py', str(REPO / 'deploy/validate-archive.py'))
        script = script.replace('/usr/local/bin/node', str(self.bin / 'node'))
        script = script.replace('/var/cache/agency', str(self.base / 'cache'))
        self.script = self.base / 'release.sh'
        self.script.write_text(script)
        archive = self.root / 'incoming' / f'{NEW}.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name in ['package.json', 'package-lock.json', '.release-sha', '.next/BUILD_ID', 'scripts/migrate.ts']:
                content = (COMMIT + '\n').encode() if name == '.release-sha' else b'{}'
                member = tarfile.TarInfo(name)
                member.mode = 0o644
                member.size = len(content)
                tar.addfile(member, io.BytesIO(content))
        self.checksum = hashlib.sha256(archive.read_bytes()).hexdigest()

    def command(self, name, body):
        path = self.bin / name
        path.write_text('#!/usr/bin/env bash\nset -euo pipefail\n' + body + '\n')
        path.chmod(0o755)

    def previous(self):
        path = self.root / 'releases' / OLD
        path.mkdir()
        (self.root / 'current').symlink_to(path)
        return path

    def run_release(self, stage='', checksum=None):
        self.env['FAIL_STAGE'] = stage
        return subprocess.run(['bash', str(self.script), NEW, checksum or self.checksum], env=self.env, capture_output=True, text=True, timeout=20)

    def test_first_release_backs_up_before_migration_and_activates(self):
        result = self.run_release()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'current').resolve().name, NEW)
        calls = self.log.read_text()
        self.assertLess(calls.index('agency-backup'), calls.index('migration'))
        self.assertLess(calls.index('migration'), calls.index('restart agency-web.service'))
        self.assertIn('start agency-maintenance.timer agency-backup.timer', calls)

    def test_checksum_failure_does_not_execute_application(self):
        previous = self.previous()
        result = self.run_release(checksum='0' * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), previous)
        self.assertEqual(self.log.read_text(), '')

    def test_backup_failure_leaves_previous_release_and_skips_migration(self):
        previous = self.previous()
        result = self.run_release('backup')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), previous)
        self.assertNotIn('migration', self.log.read_text())
        self.assertNotIn('restart', self.log.read_text())

    def test_migration_failure_leaves_previous_release_running(self):
        previous = self.previous()
        result = self.run_release('migration')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), previous)
        self.assertNotIn('restart', self.log.read_text())

    def test_wrong_release_health_response_reverts_application(self):
        previous = self.previous()
        result = self.run_release('health')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), previous)
        self.assertEqual(self.log.read_text().count('restart agency-web.service'), 2)
        self.assertNotIn('start agency-maintenance.timer', self.log.read_text())
        self.assertIn('Database changes are retained', result.stderr)

    def test_failed_first_release_stops_application(self):
        result = self.run_release('health')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / 'current').is_symlink())
        self.assertIn('stop agency-web.service', self.log.read_text())


if __name__ == '__main__':
    unittest.main()
