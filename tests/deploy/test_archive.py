"""Release validation protects paths and prevents shipping local credentials."""
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('validator', Path(__file__).parents[2] / 'deploy/validate-archive.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ArchiveTests(unittest.TestCase):
    def validate_members(self, extras=(), complete=True):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'release.tar.gz'
            with tarfile.open(path, 'w:gz') as archive:
                if complete:
                    for name in ['package.json', 'package-lock.json', '.release-sha', '.next/BUILD_ID', 'scripts/migrate.ts']:
                        info = tarfile.TarInfo(name)
                        info.size = 2
                        archive.addfile(info, io.BytesIO(b'{}'))
                for info in extras:
                    archive.addfile(info)
            validator.validate(path)

    def test_valid_runtime_archive(self):
        self.validate_members([tarfile.TarInfo('public/logo.png')])

    def test_reject_path_traversal_and_absolute_paths(self):
        for name in ['../escape', '/etc/agency/site.env', 'src/../../escape']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.validate_members([tarfile.TarInfo(name)])

    def test_reject_secrets_and_unexpected_sources(self):
        for name in ['.env.local', '.git/config', 'deploy/release.sh', 'node_modules/package/index.js']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.validate_members([tarfile.TarInfo(name)])

    def test_reject_links_and_devices(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE]:
            member = tarfile.TarInfo('public/escape')
            member.type = kind
            member.linkname = '/etc/agency/site.env'
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.validate_members([member])

    def test_accept_next_external_dependency_alias(self):
        member = tarfile.TarInfo('.next/node_modules/pg-hash')
        member.type = tarfile.SYMTYPE
        member.linkname = '../../node_modules/pg'
        self.validate_members([member])

    def test_reject_escaping_dependency_alias(self):
        member = tarfile.TarInfo('.next/node_modules/pg-hash')
        member.type = tarfile.SYMTYPE
        member.linkname = '../../../outside'
        with self.assertRaises(ValueError):
            self.validate_members([member])

    def test_reject_write_through_dependency_alias(self):
        member = tarfile.TarInfo('.next/node_modules/pg-hash')
        member.type = tarfile.SYMTYPE
        member.linkname = '../../node_modules/pg'
        with self.assertRaisesRegex(ValueError, 'write through'):
            self.validate_members([member, tarfile.TarInfo('.next/node_modules/pg-hash/file')])

    def test_reject_duplicate_member(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.validate_members([tarfile.TarInfo('package.json')])

    def test_require_runtime_files(self):
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            self.validate_members(complete=False)


if __name__ == '__main__':
    unittest.main()
