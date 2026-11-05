// Called only after the bridge has verified the parent origin and window.
const colorKeys = ['background', 'sidebar', 'header', 'content', 'primary', 'primaryHover',
  'primarySubtle', 'surfaceHover', 'text', 'textSecondary', 'border', 'borderStrong',
  'onPrimary', 'success', 'successSubtle', 'danger', 'dangerHover', 'dangerBorder'] as const;

export function applySuiteTheme(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('mode' in value)
      || (value.mode !== 'light' && value.mode !== 'dark')
      || !('colors' in value) || !value.colors || typeof value.colors !== 'object') return false;
  const colors = value.colors as Record<string, unknown>;
  if (!colorKeys.every(key => typeof colors[key] === 'string'
      && /^#[0-9a-f]{6}$/i.test(colors[key] as string))) return false;
  const root = document.documentElement;
  for (const key of colorKeys) root.style.setProperty(`--suite-${key}`, colors[key] as string);
  root.style.colorScheme = value.mode;
  root.dataset.suiteTheme = value.mode;
  return true;
}

export function clearSuiteTheme() {
  const root = document.documentElement;
  for (const key of colorKeys) root.style.removeProperty(`--suite-${key}`);
  root.style.removeProperty('color-scheme');
  delete root.dataset.suiteTheme;
}
