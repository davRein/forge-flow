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
            primaryHover: string;
            primarySubtle: string;
            surfaceHover: string;
            text: string;
            textSecondary: string;
            border: string;
            borderStrong: string;
            onPrimary: string;
            success: string;
            successSubtle: string;
            danger: string;
            dangerHover: string;
            dangerBorder: string;
        };

        shadows: {
            card: string;
            raised: string;
            overlay: string;
        };

        layout: {
            headerHeight: string;
            sidebarWidth: string;
        };
    }
}
