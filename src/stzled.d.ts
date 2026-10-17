import 'styled-components';

declare module 'styled-components' {
    export interface DefaultTheme {
        colors: {
            background: string;
            sidebar: string;
            header: string;
            content: string;
            primary: string;
            text: string;
            textSecondary: string;
            border: string;
        };

        layout: {
            headerHeight: string;
            sidebarWidth: string;
        };
    }
}