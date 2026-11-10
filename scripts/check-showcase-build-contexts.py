"""Verify context-local Dockerfiles and exact Python package pins in a release."""
import pathlib
import re
import sys
import tarfile
from showcase_python_constraints import validate_constraints


def validate_contexts(compose, files):
    inputs = re.findall(r'(?m)^      context:[ \t]*(\S+)[ \t]*\r?\n      dockerfile:[ \t]*(\S+)[ \t]*$', compose)
    if len(inputs) != len(re.findall(r'(?m)^    build:', compose)) or not inputs:
        raise ValueError('Cannot inspect every declared build context.')
    result = []
    for directory, filename in inputs:
        context, dockerfile = pathlib.PurePosixPath(directory), pathlib.PurePosixPath(filename)
        if context.is_absolute() or dockerfile.is_absolute() or '..' in context.parts or '..' in dockerfile.parts:
            raise ValueError('Build context or Dockerfile escapes its permitted directory.')
        target = str(context / dockerfile)
        if target not in files:
            raise ValueError('Packaged Dockerfile is missing: ' + target)
        result.append(target)
    return result


def validate_archive(filename):
    with tarfile.open(filename, 'r:gz') as archive:
        files = {str(pathlib.PurePosixPath(item.name)): item for item in archive.getmembers() if item.isfile()}
        compose = archive.extractfile(files['compose.yaml']).read().decode('utf-8')
        targets = validate_contexts(compose, files)
        for target in targets:
            if target.startswith('hub-web/'):
                template = 'docker/Next.Dockerfile'
            elif target.startswith(('hub-api/', 'flow-api/')):
                template = 'docker/Python.Dockerfile'
            else:
                continue
            if archive.extractfile(files[target]).read() != archive.extractfile(files[template]).read():
                raise ValueError('Packaged Dockerfile differs from its canonical template: ' + target)
        pulsewatch_dockerfile = archive.extractfile(files['pulsewatch/infra/Dockerfile.suite-frontend']).read().decode('utf-8')
        for setting in (
            'ARG VITE_API_BASE_URL=/pulsewatch-api/api/v1',
            'ARG VITE_SUITE_ORIGIN=https://forge-flow.de',
            'ENV VITE_SUITE_ORIGIN=${VITE_SUITE_ORIGIN}',
        ):
            if setting not in pulsewatch_dockerfile:
                raise ValueError('PulseWatch Suite build is missing required setting: ' + setting)
        for required in ('datascout/backend/app/suite_gateway.py', 'datascout/backend/app/suite_worker.py',
                         'datascout/backend/app/tenant.py', 'datascout/backend/requirements.lock',
                         'datascout/frontend/dist/index.html'):
            if required not in files:
                raise ValueError('Missing DataScout release file: ' + required)
        forbidden = ('.env', '.local', '.venv', '.git', 'node_modules')
        for name in files:
            if any(part in forbidden or part.startswith('.env.') for part in pathlib.PurePosixPath(name).parts):
                raise ValueError('Private/development file in release: ' + name)
        for target in ('hub-api/constraints.txt', 'flow-api/constraints.txt'):
            validate_constraints(archive.extractfile(files[target]).read().decode('utf-8'))
        for context in ('hub-api', 'flow-api'):
            expected = archive.extractfile(files['docker/image_read_access.py']).read()
            if archive.extractfile(files[context + '/image_read_access.py']).read() != expected:
                raise ValueError('Runtime-user read check missing or different in ' + context)
    return targets


if __name__ == '__main__':
    targets = validate_archive(sys.argv[1] if len(sys.argv) > 1 else 'node_modules/.tmp/forgeflow-showcase.tar.gz')
    print('PASS: release Dockerfiles are inside their contexts and both Python constraint files contain valid exact pins: ' + ', '.join(targets))
