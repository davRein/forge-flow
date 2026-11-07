"""Offline checks: clients ask for the correct app and propagate authorization denial."""
import importlib.util
import pathlib
import sys
import unittest
from urllib.error import HTTPError

ROOT = pathlib.Path(__file__).resolve().parents[1]

class ClientTests(unittest.TestCase):
    def test_clients_send_fixed_application_and_fail_closed_on_revocation(self):
        for index, (path, app) in enumerate([
            (ROOT / 'integrations/showcase/suite_client.py', 'knowledgeHub'),
            (ROOT.parent / 'ai-knowledge-hub/backend/app/core/suite_client.py', 'knowledgeHub'),
            (ROOT.parent / 'flowpilot-codex-starter/backend/src/flowpilot/suite_client.py', 'flowPilot'),
        ]):
            spec = importlib.util.spec_from_file_location('suite_client_fixture_' + str(index), path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            class Denied:
                def open(self, request, timeout):
                    self_url = 'http://127.0.0.1:3001/api/v1/auth/showcase-session?app=' + app
                    assert request.full_url == self_url
                    assert request.get_header('Cookie') == 'FORGEFLOW_SESSION=synthetic-session-token'
                    assert timeout == 3
                    raise HTTPError(self_url, 403, 'Denied', {}, None)
            with self.subTest(app=app), self.assertRaises(module.SuiteAuthenticationError) as failure:
                module.SuiteClient('http://127.0.0.1:3001/api/v1/auth/showcase-session', 'https://forge-flow.de', Denied(), app=app).identify('FORGEFLOW_SESSION=synthetic-session-token')
            self.assertEqual(failure.exception.status, 403)
            with self.assertRaises(ValueError):
                module.SuiteClient('http://127.0.0.1:3001/api/v1/auth/showcase-session', 'https://forge-flow.de', app='unknown')

    def test_every_public_location_checks_its_normalized_app(self):
        text = (ROOT / 'deploy/showcase/nginx-locations.conf').read_text()
        expected = {'knowledge-hub': 'knowledgeHub', 'knowledge-hub-api': 'knowledgeHub', 'flowpilot': 'flowPilot', 'flowpilot-api': 'flowPilot', 'pulsewatch': 'pulseWatch', 'pulsewatch-api': 'pulseWatch', 'datascout': 'dataScout', 'datascout-api': 'dataScout'}
        for prefix, app in expected.items():
            block = text.split('location ^~ /' + prefix + '/ {', 1)[1].split('\n}', 1)[0]
            self.assertIn('set $forgeflow_showcase_app ' + app + ';', block)
            self.assertIn('auth_request /_forgeflow_showcase_access;', block)
        self.assertIn('default invalid', (ROOT / 'deploy/showcase/nginx-map.conf').read_text())

if __name__ == '__main__':
    unittest.main()
