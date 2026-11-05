"""Write and validate exact pip constraints without PowerShell array conversions."""
import importlib.metadata
import pathlib
import sys

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name
from packaging.version import Version

APPLICATIONS = {'ai-knowledge-hub-backend', 'flowpilot-api'}


def validate_constraints(text):
    packages = {}
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            requirement = Requirement(line)
            specifiers = list(requirement.specifier)
            if (requirement.url or requirement.extras or requirement.marker or len(specifiers) != 1
                    or specifiers[0].operator != '=='):
                raise ValueError('Expected a single exact version.')
            Version(specifiers[0].version)
            name = canonicalize_name(requirement.name)
            if name in packages:
                raise ValueError('Duplicate package.')
            packages[name] = specifiers[0].version
        except ValueError:
            raise ValueError('Invalid exact package constraint at line ' + str(number)) from None
    if not packages:
        raise ValueError('No Python package constraints found.')
    return packages


def render_constraints(records):
    packages = {}
    for name, version in records:
        if not isinstance(name, str) or not isinstance(version, str):
            raise ValueError('Invalid installed package metadata.')
        name = canonicalize_name(name)
        if name in APPLICATIONS:
            continue
        if name in packages and packages[name] != version:
            raise ValueError('Conflicting installed package versions.')
        packages[name] = version
    text = ''.join(name + '==' + version + '\n' for name, version in sorted(packages.items()))
    validate_constraints(text)
    return text


if __name__ == '__main__':
    records = ((distribution.name, distribution.version) for distribution in importlib.metadata.distributions())
    text = render_constraints(records)
    pathlib.Path(sys.argv[1]).write_text(text, encoding='utf-8', newline='\n')
    print('Wrote ' + str(len(validate_constraints(text))) + ' validated exact Python package constraints.')
