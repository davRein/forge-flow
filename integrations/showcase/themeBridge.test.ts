import { afterEach, describe, expect, it } from 'vitest';
import { applySuiteTheme, clearSuiteTheme } from './themeBridge';

const colors = Object.fromEntries(['background', 'sidebar', 'header', 'content', 'primary',
  'primaryHover', 'primarySubtle', 'surfaceHover', 'text', 'textSecondary', 'border',
  'borderStrong', 'onPrimary', 'success', 'successSubtle', 'danger', 'dangerHover',
  'dangerBorder'].map(key => [key, '#123456']));
afterEach(clearSuiteTheme);
describe('trusted suite palette', () => {
  it('applies a complete palette and switches without retaining old variables', () => {
    expect(applySuiteTheme({ mode: 'light', colors })).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--suite-primary')).toBe('#123456');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(applySuiteTheme({ mode: 'dark', colors: { ...colors, primary: '#abcdef' } })).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--suite-primary')).toBe('#abcdef');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    clearSuiteTheme();
    expect(document.documentElement.style.getPropertyValue('--suite-primary')).toBe('');
  });
  it('rejects partial palettes and CSS injection atomically', () => {
    applySuiteTheme({ mode: 'light', colors });
    for (const value of [null, {}, { mode: 'dark', colors: {} },
      { mode: 'dark', colors: { ...colors, primary: 'url(https://wrong.test)' } },
      { mode: 'invalid', colors }]) expect(applySuiteTheme(value)).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--suite-primary')).toBe('#123456');
  });
});
