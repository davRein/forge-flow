import importlib.util
import pathlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('account_rollback', pathlib.Path(__file__).with_name('check-account-rollback.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RollbackTests(unittest.TestCase):
    def test_old_backend_only_returns_when_no_app_restrictions_would_be_lost(self):
        with tempfile.TemporaryDirectory() as directory:
            jar = pathlib.Path(directory) / 'backend.jar'
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('old.class', 'synthetic')
            for values, expected in [(['0'], True), (['1', '0'], True), (['1', '2'], False)]:
                replies = iter(values)
                self.assertEqual(module.safe(jar, lambda sql: next(replies)), expected)
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('BOOT-INF/classes/de/forgeflow/auth/AppPermissions.class', 'synthetic')
            self.assertTrue(module.safe(jar, lambda sql: self.fail('No downgrade query required for a compatible backend')))

if __name__ == '__main__':
    unittest.main()
