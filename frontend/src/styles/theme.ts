import type { DefaultTheme } from 'styled-components';

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

export const themes = { dark: darkTheme, light: lightTheme };

export default darkTheme;
