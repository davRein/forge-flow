"""Offline checks for deployment boundaries; never accesses live services or credentials."""
import importlib.util
import pathlib
import unittest
import tempfile
import sys
from unittest import mock
from showcase_python_constraints import render_constraints, validate_constraints

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'deploy/showcase'))


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'deploy' / 'showcase' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


site = load('nginx_site')
provision = load('provision')
image_access = load('image_read_access')
release_spec = importlib.util.spec_from_file_location('release_check', ROOT / 'scripts' / 'check-showcase-build-contexts.py')
release_check = importlib.util.module_from_spec(release_spec)
release_spec.loader.exec_module(release_check)


class DeploymentTests(unittest.TestCase):
    def test_production_ai_has_no_fake_fallback(self):
        ai = load('ai_config')
        self.assertEqual(ai.environments({'mode': 'disabled'}),
                         (['AI_PROVIDER=disabled'], ['FLOWPILOT_AI_MODE=disabled']))
        for config in ({'mode': 'fake'}, {'mode': 'openai'},
                       {'mode': 'openai', 'api_key': 'x' * 40, 'model': 'fixture', 'flow_daily_calls': 0}):
            with self.assertRaises(ValueError):
                ai.environments(config)
        hub, flow = ai.environments({'mode': 'openai', 'api_key': 'x' * 40, 'model': 'fixture'})
        self.assertIn('AI_PROVIDER=openai', hub)
        self.assertIn('FLOWPILOT_AI_MODE=live', flow)
        self.assertIn('FLOWPILOT_AI_DAILY_CALL_LIMIT=5', flow)
        files = provision.environment_files(provision.new_settings(), {'mode': 'disabled'})
        self.assertNotIn('AI_PROVIDER=fake', files['knowledge.env'])
        self.assertNotIn('FLOWPILOT_AI_MODE=mock', files['flowpilot.env'])
        self.assertIn('PULSEWATCH_SUITE_MODE=true', files['pulsewatch.env'])
        self.assertIn('DB_URL=jdbc:postgresql://127.0.0.1:5432/forgeflow_pulsewatch', files['pulsewatch.env'])
        self.assertNotIn('AUTH_BOOTSTRAP_PASSWORD=', files['pulsewatch.env'])
    def hub_fixture(self, root):
        for filename in ('app/main.py', 'app/manage.py', 'alembic/env.py', 'alembic.ini'):
            path = pathlib.Path(root) / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('# synthetic fixture\n', encoding='utf-8')

    def test_image_read_check_covers_application_and_migration_files(self):
        with tempfile.TemporaryDirectory() as root:
            self.hub_fixture(root)
            self.assertEqual(image_access.check_read_access(root), 4)

    def test_image_read_check_propagates_unreadable_migration_error(self):
        with tempfile.TemporaryDirectory() as root:
            self.hub_fixture(root)
            original = pathlib.Path.open
            def open_file(path, *args, **kwargs):
                if path.name == 'env.py':
                    raise PermissionError('Synthetic unreadable migration')
                return original(path, *args, **kwargs)
            with mock.patch.object(pathlib.Path, 'open', open_file), self.assertRaises(PermissionError):
                image_access.check_read_access(root)

    def test_image_read_check_rejects_missing_migration_files(self):
        with tempfile.TemporaryDirectory() as root:
            self.hub_fixture(root)
            (pathlib.Path(root) / 'alembic/env.py').unlink()
            with self.assertRaises(FileNotFoundError):
                image_access.check_read_access(root)

    def test_image_read_check_must_run_as_the_actual_runtime_user(self):
        with mock.patch.object(image_access.os, 'geteuid', return_value=0, create=True):
            with self.assertRaises(PermissionError):
                image_access.require_user(10001)
        with mock.patch.object(image_access.os, 'geteuid', return_value=10001, create=True):
            image_access.require_user(10001)

    def test_python_constraints_are_written_as_exact_pairs(self):
        result = render_constraints([('uvicorn', '0.54.0'), ('FastAPI', '0.139.0'), ('flowpilot-api', '0.1.0')])
        self.assertEqual(result, 'fastapi==0.139.0\nuvicorn==0.54.0\n')
        self.assertEqual(validate_constraints(result), {'fastapi': '0.139.0', 'uvicorn': '0.54.0'})

    def test_invalid_and_array_unrolled_constraints_are_rejected(self):
        for text in ('==\n', 'fastapi\nuvicorn\n==\n0.139.0\n0.54.0\n',
                     'fastapi>=0.139\n', 'fastapi==1.*\n', '', 'fastapi==0.139.0\nFASTAPI==0.139.0\n'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                validate_constraints(text)

    def test_conflicting_metadata_cannot_create_ambiguous_constraints(self):
        with self.assertRaises(ValueError):
            render_constraints([('FastAPI', '0.139.0'), ('fastapi', '0.140.0')])

    def test_build_dockerfile_can_be_read_inside_its_context(self):
        compose = '    build:\n      context: ./hub-api\n      dockerfile: Dockerfile\n'
        self.assertEqual(release_check.validate_contexts(compose, {'hub-api/Dockerfile'}), ['hub-api/Dockerfile'])

    def test_build_does_not_request_a_dockerfile_from_a_sibling_directory(self):
        compose = '    build:\n      context: ./hub-api\n      dockerfile: ../docker/Python.Dockerfile\n'
        with self.assertRaises(ValueError):
            release_check.validate_contexts(compose, {'docker/Python.Dockerfile'})

    def test_build_dockerfile_must_be_in_the_actual_release(self):
        compose = '    build:\n      context: ./hub-api\n      dockerfile: Dockerfile\n'
        with self.assertRaises(ValueError):
            release_check.validate_contexts(compose, set())

    def test_edits_only_the_suite_https_server_and_preserves_other_sites(self):
        http = 'server { listen 80; server_name forge-flow.de; return 301 https://forge-flow.de$request_uri; }'
        cloud = 'server { listen 443 ssl; server_name cloud.forge-flow.de; location / { proxy_pass http://127.0.0.1:8081; } }'
        suite = 'server { listen 443 ssl; server_name forge-flow.de www.forge-flow.de; # comment with }\n location / { root /var/www/forgeflow; } }'
        text = http + '\n' + cloud + '\n' + suite
        result = site.insert_include(text)
        self.assertIn(http, result)
        self.assertIn(cloud, result)
        self.assertEqual(result.count(site.INCLUDE), 1)
        self.assertEqual(site.insert_include(result), result)

    def test_refuses_ambiguous_or_conflicting_sites(self):
        suite = 'server { listen 443 ssl; server_name forge-flow.de; }'
        for value in ['', suite * 2, suite.replace(' }', ' location /flowpilot/ { root /old; } }')]:
            with self.assertRaises(ValueError):
                site.insert_include(value)

    def test_does_not_select_another_domain_or_a_comment(self):
        text = '# server { listen 443; server_name forge-flow.de; }\nserver { listen 443; server_name cloud.forge-flow.de; }'
        self.assertEqual(site.domain_blocks(text), [])

    def test_secrets_are_unique_and_round_trip_without_changing(self):
        first, second = provision.new_settings(), provision.new_settings()
        provision.validate_settings(first)
        provision.validate_settings(second)
        self.assertNotEqual(first['knowledge_password'], second['knowledge_password'])
        self.assertNotEqual(first['knowledge_password'], first['flowpilot_password'])
        self.assertEqual(provision.environment_files(first), provision.environment_files(first.copy()))

    def test_existing_managed_settings_gain_a_pulsewatch_secret_without_rotating_old_secrets(self):
        settings = provision.new_settings()
        del settings['pulsewatch_password']
        prior = settings.copy()
        updated, changed = provision.add_missing_project_secrets(settings)
        self.assertTrue(changed)
        self.assertEqual({key: updated[key] for key in prior}, prior)
        provision.validate_settings(updated)
        unchanged, changed = provision.add_missing_project_secrets(updated)
        self.assertFalse(changed)
        self.assertEqual(unchanged, updated)

    def test_environments_keep_production_auth_and_offline_providers(self):
        files = provision.environment_files(provision.new_settings())
        self.assertIn('APP_MODE=authenticated', files['knowledge.env'])
        self.assertIn('ALLOW_REGISTRATION=false', files['knowledge.env'])
        self.assertIn('AUTH_COOKIE_SECURE=true', files['knowledge.env'])
        self.assertIn('AI_PROVIDER=disabled', files['knowledge.env'])
        self.assertIn('FLOWPILOT_MODE=infrastructure', files['flowpilot.env'])
        self.assertIn('FLOWPILOT_AI_MODE=disabled', files['flowpilot.env'])
        self.assertIn('FLOWPILOT_HTTP_MODE=mock', files['flowpilot.env'])
        self.assertIn('port 6381', files['redis.conf'])
        self.assertIn('bind 127.0.0.1', files['redis.conf'])

    def test_both_apps_verify_the_live_suite_identity(self):
        files = provision.environment_files(provision.new_settings())
        for filename, prefix in (('knowledge.env', ''), ('flowpilot.env', 'FLOWPILOT_')):
            with self.subTest(filename=filename):
                self.assertIn(prefix + 'SUITE_AUTH_URL=http://127.0.0.1:3001/api/v1/auth/showcase-session\n', files[filename])
                self.assertIn(prefix + 'SUITE_ORIGIN=https://forge-flow.de\n', files[filename])

    def test_pulsewatch_is_protected_by_the_live_suite_and_overwrites_client_identity(self):
        locations = (ROOT / 'deploy/showcase/nginx-locations.conf').read_text(encoding='utf-8')
        api = locations.split('location ^~ /pulsewatch-api/ {', 1)[1].split('\n}', 1)[0]
        self.assertIn('auth_request /_forgeflow_showcase_access;', api)
        self.assertIn('auth_request_set $forgeflow_user_id $upstream_http_x_forgeflow_user_id;', api)
        self.assertIn('proxy_set_header X-ForgeFlow-User-Id $forgeflow_user_id;', api)
        self.assertIn('proxy_set_header Cookie "PULSEWATCH_SESSION=$cookie_PULSEWATCH_SESSION";', api)
        self.assertNotIn('proxy_set_header Cookie $http_cookie;', api)
        self.assertIn('PULSEWATCH_SUITE_MODE=true', provision.environment_files(provision.new_settings())['pulsewatch.env'])

    def test_pulsewatch_services_are_loopback_only_and_use_a_separate_database(self):
        compose = (ROOT / 'deploy/showcase/compose.yaml').read_text(encoding='utf-8')
        api = compose.split('  pulsewatch-api:', 1)[1].split('\n  pulsewatch-web:', 1)[0]
        web = compose.split('  pulsewatch-web:', 1)[1].split('\n  redis:', 1)[0]
        self.assertIn('network_mode: host', compose.split('x-service:', 1)[1].split('services:', 1)[0])
        self.assertNotIn('ports:', api)
        self.assertNotIn('ports:', web)
        self.assertIn('SERVER_ADDRESS=127.0.0.1', provision.environment_files(provision.new_settings())['pulsewatch.env'])
        self.assertIn("listen 127.0.0.1:3302;", (ROOT.parent / 'pulse-watch/infra/nginx.suite.conf').read_text(encoding='utf-8'))
        self.assertNotEqual(provision.PROJECTS['pulsewatch'][0], 'pulsewatch')

    def test_pulsewatch_build_files_are_in_declared_compose_contexts(self):
        compose = (ROOT / 'deploy/showcase/compose.yaml').read_text(encoding='utf-8')
        expected = {
            'hub-api/Dockerfile', 'hub-web/Dockerfile', 'flow-api/Dockerfile',
            'pulsewatch/backend/Dockerfile.suite',
            'pulsewatch/infra/Dockerfile.suite-frontend',
            'datascout/backend/Dockerfile',
        }
        self.assertEqual(set(release_check.validate_contexts(compose, expected)), expected)
        dockerfile = (ROOT.parent / 'pulse-watch/infra/Dockerfile.suite-frontend').read_text(encoding='utf-8')
        self.assertIn('ARG VITE_SUITE_ORIGIN=https://forge-flow.de', dockerfile)
        self.assertIn('ENV VITE_SUITE_ORIGIN=${VITE_SUITE_ORIGIN}', dockerfile)
        self.assertIn('ARG VITE_API_BASE_URL=/pulsewatch-api/api/v1', dockerfile)

    def test_nginx_allows_regular_suite_sessions_without_exposing_native_workspaces(self):
        locations = (ROOT / 'deploy/showcase/nginx-locations.conf').read_text(encoding='utf-8')
        self.assertIn('proxy_pass http://127.0.0.1:3001/api/v1/auth/showcase-session?app=$forgeflow_showcase_app;', locations)
        self.assertNotIn('/api/v1/auth/showcase-access;', locations)
        for path in ('knowledge-hub-api', 'flowpilot-api'):
            with self.subTest(path=path):
                block = locations.split('location ^~ /' + path + '/ {', 1)[1].split('\n}', 1)[0]
                self.assertIn('auth_request /_forgeflow_showcase_access;', block)
                self.assertIn('proxy_set_header X-ForgeFlow-Mode suite;', block)
                self.assertIn('proxy_set_header Cookie $http_cookie;', block)

    def test_flowpilot_starts_the_isolated_suite_gateway(self):
        compose = (ROOT / 'deploy/showcase/compose.yaml').read_text(encoding='utf-8')
        self.assertIn("'flowpilot.suite_gateway:create_gateway', --factory", compose)
        self.assertIn('command: [python, -m, flowpilot.suite_worker]', compose)
        installer = (ROOT / 'scripts/install-linux-showcase.sh').read_text(encoding='utf-8')
        self.assertIn('compose run --rm --no-deps flow-api python -m flowpilot.suite_gateway\n', installer)

    def test_datascout_auth_storage_and_worker_are_separate(self):
        config = provision.environment_files(provision.new_settings())['datascout.env']
        self.assertIn('DATASCOUT_SUITE_MODE=true', config)
        self.assertIn('DATASCOUT_ENABLE_PUBLIC_API=false', config)
        self.assertIn('/forgeflow_datascout', config)
        compose = (ROOT / 'deploy/showcase/compose.yaml').read_text()
        self.assertIn("'app.suite_gateway:create_suite_app', --factory", compose)
        self.assertIn('command: [python, -m, app.suite_worker]', compose)
        locations = (ROOT / 'deploy/showcase/nginx-locations.conf').read_text()
        block = locations.split('location ^~ /datascout-api/ {')[1].split('\n}')[0]
        self.assertIn('auth_request /_forgeflow_showcase_access;', block)
        self.assertIn('proxy_set_header Cookie "FORGEFLOW_SESSION=$cookie_FORGEFLOW_SESSION";', block)
        self.assertIn('proxy_set_header X-ForgeFlow-User-Id "";', block)
        self.assertIn('proxy_next_upstream off;', block)
        installer = (ROOT / 'scripts/install-linux-showcase.sh').read_text()
        self.assertIn('compose run --rm --no-deps datascout-api python -m app.suite_gateway', installer)
        self.assertIn('forgeflow_datascout; do', installer)
        self.assertIn('/datascout-api/api/v1/jobs', installer)

    def test_existing_secrets_gain_only_the_missing_datascout_secret(self):
        settings = provision.new_settings()
        del settings['datascout_password']
        updated, changed = provision.add_missing_project_secrets(settings)
        self.assertTrue(changed)
        self.assertEqual({key: updated[key] for key in settings}, settings)
        self.assertIn('datascout_password', updated)

    def test_invalid_managed_secrets_are_rejected(self):
        settings = provision.new_settings()
        settings['knowledge_password'] = "bad\nPASSWORD=override"
        with self.assertRaises(ValueError):
            provision.validate_settings(settings)

    def test_database_targets_are_distinct_from_existing_suite_and_cloud(self):
        databases = [database for database, _ in provision.PROJECTS.values()]
        self.assertEqual(set(databases), {'ai_knowledge_hub', 'flowpilot', 'forgeflow_pulsewatch', 'forgeflow_datascout'})
        self.assertNotIn('forgeflow', databases)
        self.assertNotIn('nextcloud', databases)


if __name__ == '__main__':
    unittest.main()
