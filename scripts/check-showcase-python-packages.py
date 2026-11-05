"""Resolve Linux/Python 3.12 wheels and build both staged Python projects.

Run from the suite root with a release staging directory. Downloads public PyPI files
into ignored node_modules/.tmp; installs nothing and contacts no databases/providers.
"""
import os
import pathlib
import subprocess
import sys
import tomllib

stage = pathlib.Path(sys.argv[1]).resolve()
root = pathlib.Path('node_modules/.tmp/showcase-linux-wheels').resolve()
root.mkdir(exist_ok=True)
python = pathlib.Path('../ai-knowledge-hub/backend/.venv/Scripts/python.exe').resolve()
python312 = pathlib.Path('../flowpilot-codex-starter/backend/.venv/Scripts/python.exe').resolve()
environment = {key: value for key, value in os.environ.items() if not key.startswith('PIP_')}
environment['PIP_CONFIG_FILE'] = os.devnull
for application in ('hub-api', 'flow-api'):
    project = tomllib.loads((stage / application / 'pyproject.toml').read_text(encoding='utf-8'))
    requirements = root / (application + '-requirements.txt')
    requirements.write_text('\n'.join(project['project']['dependencies']) + '\n', encoding='utf-8')
    command = [str(python), '-m', 'pip', '--disable-pip-version-check', '--no-input', 'download',
               '--index-url', 'https://pypi.org/simple', '--only-binary=:all:',
               '--python-version', '3.12', '--implementation', 'cp', '--abi', 'cp312',
               '--dest', str(root / 'wheels'), '--constraint', str(stage / application / 'constraints.txt'),
               '--requirement', str(requirements)]
    for minor in range(36, 16, -1):
        command.extend(['--platform', 'manylinux_2_' + str(minor) + '_x86_64'])
    command.extend(['--platform', 'manylinux2014_x86_64'])
    log = root / (application + '.log')
    with log.open('w', encoding='utf-8') as stream:
        result = subprocess.run(command, env=environment, stdout=stream, stderr=subprocess.STDOUT)
    if result.returncode:
        print('\n'.join(log.read_text(encoding='utf-8').splitlines()[-35:]))
        raise SystemExit('Linux Python 3.12 dependency resolution failed: ' + application)
    print('PASS: ' + application + ' runtime dependencies resolve with exact constraints; compatible Linux/Python 3.12 wheels downloaded.', flush=True)
    wheel_command = [str(python), '-m', 'pip', '--python', str(python312), '--disable-pip-version-check', '--no-input', 'wheel',
                     '--index-url', 'https://pypi.org/simple', '--no-deps',
                     '--wheel-dir', str(root / 'application-wheels'),
                     '--constraint', str(stage / application / 'constraints.txt'), str(stage / application)]
    with (root / (application + '-build.log')).open('w', encoding='utf-8') as stream:
        built = subprocess.run(wheel_command, env=environment, stdout=stream, stderr=subprocess.STDOUT)
    if built.returncode:
        print('\n'.join((root / (application + '-build.log')).read_text(encoding='utf-8').splitlines()[-35:]))
        raise SystemExit('Application wheel build failed: ' + application)
    print('PASS: ' + application + ' source project builds as a Python wheel with the corrected constraints.', flush=True)
