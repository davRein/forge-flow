"""Build production AI settings from private server configuration, without logging values."""
import json
import pathlib
import re


def private_text(path):
    path = pathlib.Path(path)
    if path.is_symlink() or path.stat().st_uid != 0 or path.stat().st_mode & 0o077:
        raise ValueError('AI configuration must be a private root-owned regular file.')
    if not path.is_file():
        raise ValueError('AI configuration must be a regular file.')
    return path.read_text(encoding='utf-8')


def read_configuration():
    # Optional explicit app configuration survives every installer run.
    path = pathlib.Path('/etc/forgeflow/showcase/ai.json')
    if path.exists() or path.is_symlink():
        return json.loads(private_text(path))
    values = {}
    for line in private_text('/etc/forgeflow/backend.env').splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip() in {'AI_ENABLED', 'OPENAI_API_KEY', 'AI_MODEL'}:
            values[key.strip()] = value.strip().strip('\"\'')
    if values.get('AI_ENABLED', '').lower() != 'true':
        return {'mode': 'disabled'}
    return {'mode': 'openai', 'api_key': values.get('OPENAI_API_KEY'),
            'model': values.get('AI_MODEL'), 'flow_daily_calls': 5}


def environments(config):
    mode = config.get('mode')
    if mode == 'disabled':
        return ['AI_PROVIDER=disabled'], ['FLOWPILOT_AI_MODE=disabled']
    if mode != 'openai':
        raise ValueError('Production AI mode must be openai or disabled; no fake fallback.')
    key, model = config.get('api_key'), config.get('model')
    limit = config.get('flow_daily_calls', 5)
    embedding = config.get('embedding_model', 'text-embedding-3-small')
    if (not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9_-]{20,512}', key)
            or not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,99}', model)
            or type(limit) is not int or not 1 <= limit <= 100
            or embedding not in {'text-embedding-3-small', 'text-embedding-3-large'}):
        raise ValueError('Incomplete production AI configuration; review privately. No fallback enabled.')
    return [
        'AI_PROVIDER=openai', 'OPENAI_API_KEY=' + key,
        'OPENAI_ANSWER_MODEL=' + model, 'OPENAI_EMBEDDING_MODEL=' + embedding,
    ], [
        'FLOWPILOT_AI_MODE=live', 'FLOWPILOT_AI_API_KEY=' + key,
        'FLOWPILOT_AI_MODEL=' + model, 'FLOWPILOT_AI_DAILY_CALL_LIMIT=' + str(limit),
        'FLOWPILOT_AI_MAX_OUTPUT_TOKENS=256',
    ]
