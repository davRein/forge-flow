"""Install theme regression tests and keep auth state tied to the active transport."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('appearance', Path(__file__).with_name('apply-showcase-appearance.py'))
appearance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(appearance)
HUB, FLOW, ROOT, edit = appearance.HUB, appearance.FLOW, appearance.ROOT, appearance.edit


def main():
    path = HUB / 'frontend/app/globals.css'
    source = path.read_text(encoding='utf-8')
    import re
    for key, token in {'background': 'content', 'panel': 'header', 'border': 'border',
                       'muted': 'textSecondary', 'accent': 'primary'}.items():
        source = re.sub(r'(--' + key + r': var\()--suite-\w+', r'\g<1>--suite-' + token, source)
    path.write_text(source, encoding='utf-8', newline='\n')
    path = FLOW / 'frontend/src/styles.css'
    source = path.read_text(encoding='utf-8')
    if '/* Suite accent artwork */' not in source:
        source += '''
/* Suite accent artwork */
html[data-suite-embedded="true"] .intro { background: var(--suite-primarySubtle); }
html[data-suite-embedded="true"] :is(.intro-tag, .intro-footer, .art-node) { color: var(--suite-primary); }
html[data-suite-embedded="true"] .art-node { background: var(--suite-header); }
html[data-suite-embedded="true"] .art-node.accent { color: var(--suite-onPrimary); background: var(--suite-primary); }
'''
        path.write_text(source, encoding='utf-8', newline='\n')
    for path, prefix in ((HUB / 'frontend/tests/theme-bridge.test.ts', '../lib/'),
                         (FLOW / 'frontend/src/themeBridge.test.ts', './')):
        source = (ROOT / 'integrations/showcase/themeBridge.test.ts').read_text(encoding='utf-8')
        path.write_text(source.replace("'./themeBridge'", repr(prefix + 'themeBridge')), encoding='utf-8', newline='\n')
    for path in (HUB / 'frontend/tests/suite-bridge.test.tsx', FLOW / 'frontend/src/suiteBridge.test.ts'):
        edit(path, 'type, section, language }', 'type, section, language, authMode: "demo" }')
    path = HUB / 'frontend/components/auth-provider.tsx'
    edit(path, 'export function AuthProvider({ children }: { children: ReactNode }) {', '''export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = runtime.useMode();
  return <AuthSessionProvider key={mode}>{children}</AuthSessionProvider>;
}

function AuthSessionProvider({ children }: { children: ReactNode }) {''')
    source = path.read_text(encoding='utf-8')
    path.write_text(source.replace('    setSession(null);\n    updateState(null);', '    setSession(null);'), encoding='utf-8', newline='\n')
    path = FLOW / 'frontend/src/workflows/WorkflowEditor.tsx'
    for before, after in [("stroke: '#789b90'", "stroke: 'var(--suite-borderStrong, #789b90)'"),
                           ('color="#cddbd6"', 'color="var(--suite-border, #cddbd6)"'),
                           ("? '#8ed5b8'", "? 'var(--suite-success, #8ed5b8)'"),
                           ("? '#e9c57d'", "? 'var(--suite-primary, #e9c57d)'"),
                           (": '#aebfe5'", ": 'var(--suite-primarySubtle, #aebfe5)'")]:
        edit(path, before, after)


if __name__ == '__main__':
    main()
