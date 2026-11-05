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
            template = 'docker/Next.Dockerfile' if target.startswith('hub-web/') else 'docker/Python.Dockerfile'
            if archive.extractfile(files[target]).read() != archive.extractfile(files[template]).read():
                raise ValueError('Packaged Dockerfile differs from its canonical template: ' + target)
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
