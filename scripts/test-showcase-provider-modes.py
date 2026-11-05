"""Offline AI-mode checks. Run once with each app's Python interpreter and its name."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = sys.argv.pop(1)


class ProviderModeTests(unittest.TestCase):
    def test_disabled_production_never_returns_fake_output(self):
        if APP == 'hub':
            sys.path.insert(0, str(ROOT.parent / 'ai-knowledge-hub/backend'))
            from app.core.config import Settings
            from app.providers.base import ProviderError
            from app.providers.factory import create_provider
            settings = Settings(_env_file=None, ai_provider='disabled')
            provider = create_provider(settings)
            self.assertEqual(provider.name, 'disabled')
            with self.assertRaises(ProviderError):
                provider.embed(['synthetic fixture'])
            with self.assertRaises(ProviderError):
                provider.answer('synthetic question', [])
            self.assertEqual(create_provider(Settings(_env_file=None)).name, 'fake')
        else:
            sys.path.insert(0, str(ROOT.parent / 'flowpilot-codex-starter/backend/src'))
            from flowpilot.config import Settings
            from flowpilot.ai.service import AIService
            from flowpilot.executions.actions import NodeFailure
            service = AIService(Settings(_env_file=None, ai_mode='disabled'))
            status = service.status()
            self.assertEqual(status['mode'], 'disabled')
            self.assertEqual(status['model'], 'disabled')
            self.assertFalse(status['paid_calls_enabled'])
            self.assertIsNone(service.provider)
            with self.assertRaises(NodeFailure):
                service.execute('ai_classify', 'synthetic', 'demo interested')
            self.assertEqual(AIService(Settings(_env_file=None)).status()['mode'], 'mock')


if __name__ == '__main__':
    unittest.main()
