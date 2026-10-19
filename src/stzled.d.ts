import 'styled-components';

declare module 'styled-components' {
    export interface DefaultTheme {
        mode: 'dark' | 'light';
        colors: {
            background: string;
            sidebar: string;
            header: string;
            content: string;
            primary: string;
            text: string;
            textSecondary: string;
            border: string;
            onPrimary: string;
            danger: string;
            dangerHover: string;
            dangerBorder: string;
        };

        layout: {
            headerHeight: string;
            sidebarWidth: string;
        };
    }
}
