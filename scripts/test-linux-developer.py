#!/usr/bin/env python3
"""Offline tests, no configuration writes, installation, database or provider requests."""
import base64
import importlib.util
import pathlib
import unittest
spec = importlib.util.spec_from_file_location('developer_setup', pathlib.Path(__file__).with_name('configure-linux-developer.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigurationTests(unittest.TestCase):
    def test_adds_one_random_key_and_is_idempotent(self):
        text = 'APP_ORIGIN=https://forge-flow.de\nAI_MODEL=test-only-model\n'
        value = module.configure(text)
        self.assertIn(text, value)
        self.assertEqual(len(base64.b64decode(module.values(value)['INTEGRATION_SECRET_KEY'])), 32)
        self.assertEqual(module.configure(value), value)
        self.assertNotEqual(module.values(module.configure(text))['INTEGRATION_SECRET_KEY'], module.values(value)['INTEGRATION_SECRET_KEY'])

    def test_existing_quoted_key_and_disabled_trials_are_preserved(self):
        key = base64.b64encode(bytes(32)).decode('ascii')
        text = 'INTEGRATION_SECRET_KEY="' + key + '"\nTRIAL_ACCOUNTS_ENABLED=false\nDEV_DB_HOSTS=localhost,db.example.test\n'
        value = module.configure(text)
        self.assertIn(text, value)
        self.assertEqual(module.values(value)['INTEGRATION_SECRET_KEY'], key)

    def test_invalid_or_duplicate_keys_are_rejected_without_rotation(self):
        for text in ('INTEGRATION_SECRET_KEY=bad\n', 'DEV_GIT_ROOT=/a\nDEV_GIT_ROOT=/b\n'):
            with self.assertRaises(ValueError):
                module.configure(text)

    def test_empty_values_are_replaced_without_duplicate_settings(self):
        text = module.configure('INTEGRATION_SECRET_KEY=\nDEV_GIT_ROOT=\n')
        self.assertEqual(text.count('INTEGRATION_SECRET_KEY='), 1)
        self.assertEqual(module.values(text)['DEV_GIT_ROOT'], '/var/lib/forgeflow/git')


if __name__ == '__main__':
    unittest.main()
