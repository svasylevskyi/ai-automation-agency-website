#!/usr/bin/env python3
"""Reject unexpected archive members before release installation."""
import pathlib
import re
import sys
import tarfile

ALLOWED = {'.next', 'public', 'src', 'scripts', 'migrations', 'package.json',
           'package-lock.json', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json',
           'postcss.config.mjs', '.release-sha'}

def validate(path):
    total = 0
    names = set()
    files = set()
    links = set()
    with tarfile.open(path, 'r:gz') as archive:
        for member in archive:
            name = pathlib.PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] not in ALLOWED:
                raise ValueError('Unsafe or unexpected archive path')
            if member.issym():
                # Next emits hashed aliases to external packages. Only these
                # links into this release's own npm-installed dependencies pass.
                if (len(name.parts) != 3 or name.parts[:2] != ('.next', 'node_modules')
                        or not re.fullmatch(r'\.\./\.\./node_modules/(?:@[a-zA-Z0-9][a-zA-Z0-9._-]*/)?[a-zA-Z0-9][a-zA-Z0-9._-]*', member.linkname)):
                    raise ValueError('Unsafe archive link')
                links.add(str(name))
            elif not (member.isfile() or member.isdir()):
                raise ValueError('Archive hard links and special files are forbidden')
            if str(name) in names:
                raise ValueError('Duplicate archive member')
            names.add(str(name))
            if member.isfile():
                files.add(str(name))
            total += member.size
            if total > 512 * 1024 * 1024 or len(names) > 50000:
                raise ValueError('Archive exceeds release limits')
    if any(name.startswith(link + '/') for link in links for name in names):
        raise ValueError('Archive cannot write through a dependency link')
    for required in ('package.json', 'package-lock.json', '.release-sha', '.next/BUILD_ID', 'scripts/migrate.ts'):
        if required not in files:
            raise ValueError('Incomplete application archive')

if __name__ == '__main__':
    try:
        validate(sys.argv[1])
    except (ValueError, tarfile.TarError, OSError) as error:
        sys.exit(f'Invalid release: {error}')
