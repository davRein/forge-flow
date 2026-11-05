"""Hub session regression using an isolated SQLite database and mocked Suite identity."""
import importlib.util
import sys
import tempfile
import unittest
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'ai-knowledge-hub/backend'))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api import auth
from app.core.config import Settings
from app.core.suite_client import SuiteClient, SuiteIdentity
from app.db.session import get_session
from app.main import create_app
from app.models import User
from app.models.suite import SuiteLink

spec = importlib.util.spec_from_file_location('hub_suite_regression', ROOT / 'integrations/showcase/hub_suite.py')
suite = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = suite
spec.loader.exec_module(suite)


class HubSessionTests(unittest.TestCase):
    def test_first_session_repeated_session_and_separate_owner(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'node_modules/.tmp') as directory:
            url = 'sqlite:///' + (Path(directory) / 'hub.db').as_posix()
            engine = create_engine(url)
            User.__table__.create(engine)
            SuiteLink.__table__.create(engine)
            settings = Settings(_env_file=None, database_url=url, app_mode='authenticated',
                                security_key='t' * 48, suite_origin='https://forge-flow.de',
                                suite_auth_url='http://127.0.0.1:3001/api/v1/auth/showcase-session')
            app = create_app(settings)

            def sessions() -> Iterator[Session]:
                with Session(engine, expire_on_commit=False) as session:
                    yield session

            app.dependency_overrides[get_session] = sessions
            identity = SuiteIdentity('https://forge-flow.de', 'test-owner',
                                     'owner@example.test', 'Test Owner', False)
            try:
                with patch.object(auth, 'suite_user', suite.suite_user), \
                     patch.object(SuiteClient, 'identify', return_value=identity) as identify, \
                     TestClient(app) as client:
                    headers = {'X-ForgeFlow-Mode': 'suite',
                               'Cookie': 'FORGEFLOW_SESSION=synthetic-session-token'}
                    first = client.get('/api/auth/session', headers=headers)
                    self.assertEqual(first.status_code, 200, first.text)
                    self.assertEqual(first.json()['auth_source'], 'suite')
                    self.assertFalse(first.json()['user']['external_ai_consent'])
                    again = client.get('/api/auth/session', headers=headers)
                    self.assertEqual(again.status_code, 200, again.text)
                    self.assertEqual(first.json()['user']['id'], again.json()['user']['id'])
                    identify.return_value = SuiteIdentity(identity.issuer, 'second-owner',
                                                         identity.email, identity.name, False)
                    other = client.get('/api/auth/session', headers=headers)
                    self.assertEqual(other.status_code, 200, other.text)
                    self.assertNotEqual(first.json()['user']['id'], other.json()['user']['id'])
                with Session(engine) as session:
                    self.assertEqual(session.scalar(select(func.count()).select_from(User)), 2)
                    self.assertEqual(session.scalar(select(func.count()).select_from(SuiteLink)), 2)
                    for user in session.scalars(select(User)):
                        self.assertEqual(user.privacy_accepted_at, 0)
                        self.assertFalse(user.external_ai_consent)
            finally:
                app.state.engine.dispose()
                engine.dispose()


if __name__ == '__main__':
    unittest.main()
