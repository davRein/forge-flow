"""Build-time read check for the actual unprivileged Python image user."""
import os
import pathlib
import sys


def require_user(expected):
    if not hasattr(os, 'geteuid') or os.geteuid() != expected:
        raise PermissionError('Run the image read check as runtime UID ' + str(expected))


def check_read_access(root):
    root = pathlib.Path(root)
    count = 0

    def raise_walk_error(error):
        raise error

    # os.walk's explicit error handler prevents unreadable subdirectories being skipped.
    for directory, _, files in os.walk(root, onerror=raise_walk_error):
        for filename in files:
            with (pathlib.Path(directory) / filename).open('rb') as stream:
                stream.read(1)
            count += 1
    if (root / 'app').is_dir():
        required = ('app/main.py', 'app/manage.py', 'alembic/env.py', 'alembic.ini')
    elif (root / 'src/flowpilot').is_dir():
        required = ('src/flowpilot/main.py', 'src/flowpilot/migrations/005_ai_budget.sql')
    else:
        raise ValueError('Expected packaged Hub or FlowPilot application.')
    for filename in required:
        with (root / filename).open('rb') as stream:
            stream.read(1)
    return count


if __name__ == '__main__':
    require_user(int(sys.argv[2]))
    count = check_read_access(sys.argv[1])
    print('Runtime-user read check passed for ' + str(count) + ' application files.')
