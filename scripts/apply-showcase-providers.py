"""Add an explicit unavailable AI mode without changing local demo defaults or secrets."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('appearance', Path(__file__).with_name('apply-showcase-appearance.py'))
appearance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(appearance)
HUB, FLOW, edit = appearance.HUB, appearance.FLOW, appearance.edit


def main():
    backend = HUB / 'backend/app'
    edit(backend / 'core/config.py', 'Literal["fake", "openai"]', 'Literal["fake", "openai", "disabled"]')
    edit(backend / 'providers/factory.py', 'from app.providers.base import AIProvider, ProviderError',
         'from app.providers.base import AIProvider, Evidence, GroundedAnswer, ProviderError')
    edit(backend / 'providers/factory.py', 'def create_provider(settings: Settings) -> AIProvider:', '''class DisabledProvider:
    name = "disabled"
    profile = "disabled"

    def embed(self, texts: list[str]) -> list[list[float]]:
        raise ProviderError("AI is not configured on the server. Contact your administrator.")

    def answer(self, question: str, evidence: list[Evidence]) -> GroundedAnswer:
        raise ProviderError("AI is not configured on the server. Contact your administrator.")


def create_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "disabled":
        return DisabledProvider()''')
    for path in (backend / 'schemas').glob('*.py'):
        source = path.read_text(encoding='utf-8')
        if 'Literal["fake", "openai"]' in source:
            edit(path, 'Literal["fake", "openai"]', 'Literal["fake", "openai", "disabled"]')
    for path in (HUB / 'frontend/lib/documents.ts', HUB / 'frontend/lib/chat.ts',
                 HUB / 'frontend/components/workspace-provider.tsx'):
        source = path.read_text(encoding='utf-8')
        if '"fake" | "openai"' in source:
            edit(path, '"fake" | "openai"', '"fake" | "openai" | "disabled"')
    edit(HUB / 'frontend/components/chat-workspace.tsx', 'Boolean(provider) &&',
         'Boolean(provider) && provider !== "disabled" &&')
    edit(HUB / 'frontend/components/chat-workspace.tsx', ': tx("Connecting to the provider…")',
         ': provider === "disabled" ? tx("AI not configured") : tx("Connecting to the provider…")')
    edit(HUB / 'frontend/components/chat-workspace.tsx', '"Start the backend to load your document library and provider.",',
         'provider === "disabled" ? "AI is not configured on the server. Contact your administrator." : "Start the backend to load your document library and provider.",')
    edit(HUB / 'frontend/components/workspace-shell.tsx', ': tx("CONNECTING")',
         ': provider === "disabled" ? tx("AI not configured") : tx("CONNECTING")')
    edit(HUB / 'frontend/components/upload-zone.tsx', 'Boolean(operation) ||',
         'provider === "disabled" || Boolean(operation) ||')
    backend = FLOW / 'backend/src/flowpilot'
    edit(backend / 'config.py', 'Literal["mock", "live"]', 'Literal["mock", "live", "disabled"]')
    edit(backend / 'ai/service.py', 'else MockProvider()',
         'else (MockProvider() if settings.ai_mode == "mock" else None)')
    edit(backend / 'ai/service.py', '        if not value.strip()',
         '        if self.provider is None or self.settings.ai_mode == "disabled":\n            raise NodeFailure("ai_not_configured", "AI is not configured on the server.")\n        if not value.strip()')
    edit(backend / 'ai/service.py', 'else "flowpilot-mock-v1",',
         'else ("flowpilot-mock-v1" if self.settings.ai_mode == "mock" else "disabled"),')
    edit(FLOW / 'frontend/src/ai/client.ts', "z.enum(['mock', 'live'])", "z.enum(['mock', 'live', 'disabled'])")
    edit(FLOW / 'frontend/src/ai/AISettings.tsx', "? status.mode === 'mock'", "? status.mode === 'disabled'\n              ? tx('AI not configured')\n              : status.mode === 'mock'")
    for path in (HUB / 'frontend/translations.ts', FLOW / 'frontend/src/translations.ts'):
        edit(path, 'export const german: Readonly<Record<string, string>> = {', '''export const german: Readonly<Record<string, string>> = {
  'AI not configured': 'KI nicht konfiguriert',
  'AI is not configured on the server. Contact your administrator.': 'KI ist auf dem Server noch nicht konfiguriert. Bitte wende dich an die Administration.',
  'AI is not configured on the server.': 'KI ist auf dem Server noch nicht konfiguriert.', ''')


if __name__ == '__main__':
    main()
