#!/usr/bin/env python3
"""Attach showcase locations to exactly the existing forge-flow.de HTTPS virtual host."""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

INCLUDE = 'include /etc/nginx/forgeflow-showcase.locations.conf;'
TOKEN = re.compile(r'''\#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{};]|[^\s{};\#"']+''')


def domain_blocks(text):
    tokens = [item for item in TOKEN.finditer(text) if not item[0].startswith('#')]
    stack = []
    candidates = []
    for index, token in enumerate(tokens):
        if token[0] == '{':
            stack.append((tokens[index - 1][0] == 'server' if index else False, token.end()))
        elif token[0] == '}':
            if not stack:
                raise ValueError('Unbalanced nginx file; automatic edit refused.')
            server, opening = stack.pop()
            if not server:
                continue
            body = text[opening:token.start()]
            clean = re.sub(r'(?m)#.*$', '', body)
            names = re.findall(r'\bserver_name\s+([^;]+);', clean)
            if any('forge-flow.de' in nameset.split() for nameset in names) and re.search(r'\blisten\s+[^;]*\b443\b[^;]*;', clean):
                candidates.append((opening, body))
    if stack:
        raise ValueError('Unbalanced nginx file; automatic edit refused.')
    return candidates


def insert_include(text):
    blocks = domain_blocks(text)
    if len(blocks) != 1:
        raise ValueError('Expected exactly one HTTPS virtual host for forge-flow.de.')
    opening, body = blocks[0]
    if INCLUDE in body:
        return text
    if '/knowledge-hub' in body or '/flowpilot' in body:
        raise ValueError('Existing showcase routes need reconciliation; no automatic overwrite.')
    return text[:opening] + '\n    ' + INCLUDE + '\n' + text[opening:]


def nginx_files(dump):
    return sorted(set(re.findall(r'^# configuration file (/etc/nginx/[^\n:]+):$', dump, re.MULTILINE)))


def main():
    source = pathlib.Path(sys.argv[1]).resolve()
    backup = pathlib.Path(sys.argv[2]).resolve()
    result = subprocess.run(['nginx', '-T'], capture_output=True, text=True, check=True)
    candidates = []
    for filename in nginx_files(result.stdout):
        path = pathlib.Path(filename).resolve()
        if not path.is_relative_to('/etc/nginx') or path.stat().st_uid != 0:
            raise ValueError('Unexpected nginx configuration path or owner.')
        text = path.read_text(encoding='utf-8')
        if domain_blocks(text):
            candidates.append((path, text))
    # Resolve symlink aliases before selecting the single public site.
    candidates = list({str(path): (path, text) for path, text in candidates}.values())
    if len(candidates) != 1:
        raise ValueError('Cannot uniquely select the existing forge-flow.de HTTPS configuration.')
    path, text = candidates[0]
    updated = insert_include(text)
    destinations = [(path, updated),
                    (pathlib.Path('/etc/nginx/conf.d/forgeflow-showcase-map.conf'), (source / 'nginx-map.conf').read_text()),
                    (pathlib.Path('/etc/nginx/forgeflow-showcase.locations.conf'), (source / 'nginx-locations.conf').read_text())]
    state = []
    for index, (destination, content) in enumerate(destinations):
        if destination.is_symlink():
            raise ValueError('Refusing a managed nginx symlink.')
        if index and destination.exists() and not destination.read_text().startswith(('# Loaded in http context.', 'location = /_forgeflow_showcase_access')):
            raise ValueError('Unmanaged nginx snippet exists; no replacement performed.')
        entry = {'path': str(destination), 'existed': destination.exists(), 'backup': 'nginx-' + str(index)}
        if destination.exists():
            shutil.copy2(destination, backup / entry['backup'])
        state.append(entry)
    # Persist the complete restoration plan before the first edit.
    (backup / 'nginx-state.json').write_text(json.dumps(state), encoding='utf-8')
    for destination, content in destinations:
        temporary = destination.with_name(destination.name + '.showcase-new')
        if temporary.exists() or temporary.is_symlink():
            raise ValueError('An unfinished nginx edit needs review.')
        with open(temporary, 'x', encoding='utf-8') as stream:
            stream.write(content)
        temporary.chmod(0o644)
        os.replace(temporary, destination)
    subprocess.run(['nginx', '-t'], check=True)
    print('Attached showcase routes to the existing forge-flow.de HTTPS site.')


def restore(backup):
    state = backup / 'nginx-state.json'
    if not state.exists():
        return
    for entry in json.loads(state.read_text(encoding='utf-8')):
        destination = pathlib.Path(entry['path'])
        if not destination.is_relative_to('/etc/nginx') or destination.is_symlink():
            raise ValueError('Unexpected rollback path.')
        if entry['existed']:
            shutil.copy2(backup / entry['backup'], destination)
        elif destination.exists():
            destination.unlink()


if __name__ == '__main__':
    try:
        if os.geteuid() != 0:
            raise ValueError('Run with sudo.')
        if sys.argv[1] == '--restore':
            restore(pathlib.Path(sys.argv[2]))
        else:
            main()
    except (ValueError, OSError, subprocess.SubprocessError, IndexError):
        raise SystemExit('Nginx preparation failed; no configuration or secret contents printed. Restore from the deployment backup before retrying.') from None
