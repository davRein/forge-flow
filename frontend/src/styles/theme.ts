import type { DefaultTheme } from 'styled-components';

const layout = { headerHeight: '70px', sidebarWidth: '250px' };

export const darkTheme: DefaultTheme = {
    mode: 'dark',
    colors: {
        background: '#1e1f25',
        sidebar: '#18191f',
        header: '#24262d',
        content: '#2b2e36',
        primary: '#4f8cff',
        text: '#ffffff',
        textSecondary: '#b7bcc8',
        border: '#3a3d46',
        onPrimary: '#0b1730',
        danger: '#ff9b9b',
        dangerHover: '#ffbcbc',
        dangerBorder: '#b94c54'
    },

    layout
};

export const lightTheme: DefaultTheme = {
    mode: 'light',
    colors: {
        background: '#f1f5f9',
        sidebar: '#e9eef5',
        header: '#ffffff',
        content: '#f8fafc',
        primary: '#1d4ed8',
        text: '#182438',
        textSecondary: '#526076',
        border: '#cbd5e1',
        onPrimary: '#ffffff',
        danger: '#b91c1c',
        dangerHover: '#991b1b',
        dangerBorder: '#d59b9b'
    },
    layout
};

export const themes = { dark: darkTheme, light: lightTheme };

export default darkTheme;
