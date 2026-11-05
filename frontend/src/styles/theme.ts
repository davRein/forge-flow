import type { DefaultTheme } from 'styled-components';
import type { ThemeMode } from '../types/settings.types';

const layout = { headerHeight: '64px', sidebarWidth: '232px' };

export const darkTheme: DefaultTheme = {
    mode: 'dark',
    colors: {
        background: '#15191e',
        sidebar: '#1b2027',
        header: '#222830',
        content: '#191e25',
        primary: '#8bb8ff',
        primaryHover: '#adcfff',
        primarySubtle: '#263b57',
        surfaceHover: '#2b333e',
        text: '#e2e8f0',
        textSecondary: '#a6b2c2',
        border: '#343e4b',
        borderStrong: '#68788d',
        onPrimary: '#14243e',
        success: '#7ee2ad',
        successSubtle: '#213c31',
        danger: '#ffaaa3',
        dangerHover: '#ffc8c3',
        dangerBorder: '#965a5b'
    },
    shadows: {
        card: '0 1px 2px rgb(0 0 0 / 12%)',
        raised: '0 4px 14px rgb(0 0 0 / 22%)',
        overlay: '0 16px 48px rgb(0 0 0 / 40%)'
    },
    layout
};

export const lightTheme: DefaultTheme = {
    mode: 'light',
    colors: {
        background: '#f7f8fa',
        sidebar: '#f7f8fa',
        header: '#ffffff',
        content: '#f7f8fa',
        primary: '#0c56c9',
        primaryHover: '#0847a6',
        primarySubtle: '#e9f1ff',
        surfaceHover: '#f0f2f5',
        text: '#243247',
        textSecondary: '#56657a',
        border: '#dce1e8',
        borderStrong: '#8493a8',
        onPrimary: '#ffffff',
        success: '#147544',
        successSubtle: '#e8f6ee',
        danger: '#b91c1c',
        dangerHover: '#991b1b',
        dangerBorder: '#d59b9b'
    },
    shadows: {
        card: '0 1px 2px rgb(25 42 70 / 5%)',
        raised: '0 4px 14px rgb(25 42 70 / 9%)',
        overlay: '0 16px 48px rgb(25 42 70 / 20%)'
    },
    layout
};

export const auroraTheme: DefaultTheme = {
    ...darkTheme,
    colors: {
        background: '#101e24', sidebar: '#13262d', header: '#1b3038', content: '#14272e',
        primary: '#78ddc7', primaryHover: '#a2eddd', primarySubtle: '#23473f',
        surfaceHover: '#29424b', text: '#e4f0ed', textSecondary: '#b0c5c5',
        border: '#36515a', borderStrong: '#70958f', onPrimary: '#102e29',
        success: '#9de2b2', successSubtle: '#254336', danger: '#ffb6a3',
        dangerHover: '#ffd0c3', dangerBorder: '#a06c61'
    }
};

export const duneTheme: DefaultTheme = {
    ...lightTheme,
    colors: {
        background: '#f4eee4', sidebar: '#eee5d8', header: '#fffbf4', content: '#f6f0e7',
        primary: '#98452e', primaryHover: '#783421', primarySubtle: '#f7e3d7',
        surfaceHover: '#eee1d2', text: '#3c3029', textSecondary: '#6c5849',
        border: '#d9caba', borderStrong: '#9d8069', onPrimary: '#fffaf4',
        success: '#2d6545', successSubtle: '#e6efdf', danger: '#a9322a',
        dangerHover: '#86251f', dangerBorder: '#c99082'
    }
};

export const forestTheme: DefaultTheme = {
    ...lightTheme,
    colors: {
        ...lightTheme.colors,
        background: '#f3f7f1', sidebar: '#e6eee2', header: '#fcfef9', content: '#f3f7f1',
        primary: '#285c39', primaryHover: '#1d482b', primarySubtle: '#deead9',
        surfaceHover: '#e5eddf', text: '#25352a', textSecondary: '#52644f',
        border: '#cbd9c5', borderStrong: '#7b9474'
    }
};
export const inkTheme: DefaultTheme = {
    ...darkTheme,
    colors: {
        ...darkTheme.colors,
        background: '#1b1826', sidebar: '#211d30', header: '#2a243b', content: '#201c2d',
        primary: '#c8b5ff', primaryHover: '#dfd0ff', primarySubtle: '#3e3154',
        surfaceHover: '#342d45', text: '#eee8f6', textSecondary: '#c4b7d6',
        border: '#4a405c', borderStrong: '#9583ad', onPrimary: '#2b1c43'
    }
};
export const roseTheme: DefaultTheme = {
    ...lightTheme,
    colors: {
        ...lightTheme.colors,
        background: '#fbf3f4', sidebar: '#f2e3e7', header: '#fffbfc', content: '#fbf3f4',
        primary: '#8b3454', primaryHover: '#702440', primarySubtle: '#f3dce5',
        surfaceHover: '#f1e2e7', text: '#432c36', textSecondary: '#70515e',
        border: '#dfc6d0', borderStrong: '#a57b8d'
    }
};
export const themes: Record<ThemeMode, DefaultTheme> = { dark: darkTheme, light: lightTheme, aurora: auroraTheme, dune: duneTheme, forest: forestTheme, ink: inkTheme, rose: roseTheme };
export const themeOptions: ReadonlyArray<{ id: ThemeMode; label: string; description: string }> = [
    { id: 'dark', label: 'Dunkel', description: 'Graphit und Blau' },
    { id: 'light', label: 'Hell', description: 'Klares Weiß und Blau' },
    { id: 'aurora', label: 'Aurora', description: 'Petrol und Mint' },
    { id: 'dune', label: 'Dune', description: 'Sand und Terrakotta' },
    { id: 'forest', label: 'Forest', description: 'Salbei und Waldgrün' },
    { id: 'ink', label: 'Ink', description: 'Nachttinte und Lavendel' },
    { id: 'rose', label: 'Rose', description: 'Rosé und Bordeaux' }
];

export default darkTheme;
