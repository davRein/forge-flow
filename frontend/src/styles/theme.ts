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

export const themes: Record<ThemeMode, DefaultTheme> = { dark: darkTheme, light: lightTheme, aurora: auroraTheme, dune: duneTheme };
export const themeOptions: ReadonlyArray<{ id: ThemeMode; label: string; description: string }> = [
    { id: 'dark', label: 'Dunkel', description: 'Graphit und Blau' },
    { id: 'light', label: 'Hell', description: 'Klares Weiß und Blau' },
    { id: 'aurora', label: 'Aurora', description: 'Petrol und Mint' },
    { id: 'dune', label: 'Dune', description: 'Sand und Terrakotta' }
];

export default darkTheme;
