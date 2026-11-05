"""Apply suite theme integration to the two adjacent application source trees."""
from pathlib import Path
import colorsys
import re

ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT.parent / 'ai-knowledge-hub'
FLOW = ROOT.parent / 'flowpilot-codex-starter'


def edit(path, before, after):
    source = path.read_text(encoding='utf-8')
    if after in source:
        return
    if before not in source:
        raise ValueError(f'Expected source not found: {path}: {before[:70]}')
    path.write_text(source.replace(before, after), encoding='utf-8', newline='\n')


def css_theme(path, hub):
    source = path.read_text(encoding='utf-8')
    if '--suite-' in source:
        return
    # Keep standalone defaults as CSS fallbacks; the parent supplies only hex colors.
    def replace(match):
        prop, rest = match.group(1), match.group(2)
        def color(token):
            value = token.group()
            raw = value[1:]
            if len(raw) == 3:
                raw = ''.join(c * 2 for c in raw)
            if len(raw) != 6:
                return value
            r, g, b = (int(raw[i:i+2], 16) / 255 for i in (0, 2, 4))
            hue, light, saturation = colorsys.rgb_to_hls(r, g, b)
            foreground = prop in ('color', 'fill', 'stroke')
            border = 'border' in prop or 'outline' in prop or 'scrollbar' in prop
            semantic = None
            if saturation > .25 and (hue < .06 or hue > .93):
                semantic = 'danger' if foreground else ('dangerBorder' if border else 'primarySubtle')
            elif saturation > .18 and .22 < hue < .46:
                semantic = 'success' if foreground else ('border' if border else 'successSubtle')
            elif saturation > .25 and (hue > .58 if hub else .35 < hue < .57):
                semantic = 'primary' if foreground or border else ('primarySubtle' if light < .25 or light > .8 else 'primary')
            if semantic is None:
                if foreground:
                    semantic = 'textSecondary' if .32 < light < .78 else 'text'
                elif border:
                    semantic = 'borderStrong' if .3 < light < .7 else 'border'
                else:
                    semantic = 'header' if light > .96 else ('content' if light < .18 or light > .89 else 'surfaceHover')
            return f'var(--suite-{semantic}, {value})'
        return prop + ':' + re.sub(r'#[0-9a-fA-F]{3,8}\b', color, rest)
    source = re.sub(r'([\w-]+):([^;{}]+)', replace, source)
    source += '''
/* Shared suite typography and semantic controls; standalone fallbacks remain above. */
html[data-suite-embedded="true"] body {
  color: var(--suite-text);
  background: var(--suite-content);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
html[data-suite-embedded="true"] :is(input, textarea, select) {
  color: var(--suite-text);
  background-color: var(--suite-header);
  border-color: var(--suite-borderStrong);
  accent-color: var(--suite-primary);
}
html[data-suite-embedded="true"] :is(.primary-button, .action-button):not(.danger) {
  color: var(--suite-onPrimary);
  background: var(--suite-primary);
  border-color: var(--suite-primary);
}
html[data-suite-embedded="true"] :is(.primary-button, .action-button):not(.danger):hover:not(:disabled) {
  background: var(--suite-primaryHover);
}
html[data-suite-embedded="true"] :is(.danger, .danger-button, .document-error, .state-failed) {
  color: var(--suite-danger);
}
html[data-suite-embedded="true"] :is(button, a, input, textarea, select):focus-visible {
  outline: 2px solid var(--suite-primary);
  outline-offset: 3px;
}
'''
    path.write_text(source, encoding='utf-8', newline='\n')


def main():
    helper = (ROOT / 'integrations/showcase/themeBridge.ts').read_text(encoding='utf-8')
    for path in (HUB / 'frontend/lib/themeBridge.ts', FLOW / 'frontend/src/themeBridge.ts'):
        path.write_text(helper, encoding='utf-8', newline='\n')
    for path, location in ((HUB / 'frontend/components/suite-bridge.tsx', '../lib/themeBridge'),
                           (FLOW / 'frontend/src/suiteBridge.ts', './themeBridge')):
        edit(path, 'import { runtime }', f'import {{ applySuiteTheme, clearSuiteTheme }} from "{location}";\nimport {{ runtime }}')
        edit(path, 'if (!runtime.accept(event.data.authMode)) return;',
             'if (!runtime.accept(event.data.authMode)) return;\n        applySuiteTheme(event.data.theme);')
        edit(path, 'event.data.type === "language"' if 'knowledge' in str(path) else "event.data.type === 'language'",
             'event.data.type === "language"' if 'knowledge' in str(path) else "event.data.type === 'language'")
        # Insert theme messages before language handling, retaining the same trusted source gate.
        source = path.read_text(encoding='utf-8')
        marker = '      } else if (' if 'knowledge' in str(path) else '    } else if ('
        if 'event.data.type === "theme"' not in source:
            source = source.replace(marker, '    } else if (connected' + ('.current' if 'knowledge' in str(path) else '')
                                    + ' && event.data.type === "theme") {\n      applySuiteTheme(event.data.theme);\n'
                                    + marker, 1)
            path.write_text(source, encoding='utf-8', newline='\n')
        edit(path, 'delete document.documentElement.dataset.suiteEmbedded;',
             'clearSuiteTheme();\n      delete document.documentElement.dataset.suiteEmbedded;')
    css_theme(HUB / 'frontend/app/globals.css', True)
    for path in (FLOW / 'frontend/src').rglob('*.css'):
        css_theme(path, False)


if __name__ == '__main__':
    main()
