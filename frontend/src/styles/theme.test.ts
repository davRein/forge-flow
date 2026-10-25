import { themes } from './theme.js';

function luminance(hex: string): number {
    const channels = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255)
        .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function checkContrast(foreground: string, background: string, label: string) {
    const a = luminance(foreground), b = luminance(background);
    const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (contrast < 4.5) throw new Error(`${label}: ${contrast.toFixed(2)}:1 is below 4.5:1`);
}

export const themeTests = [
    { name: 'New palettes provide readable text, links and primary actions', run() {
        for (const name of ['aurora', 'dune'] as const) {
            const { colors } = themes[name];
            for (const surface of ['background', 'sidebar', 'header', 'content', 'surfaceHover', 'primarySubtle'] as const) {
                for (const text of ['text', 'textSecondary', 'primary'] as const) {
                    checkContrast(colors[text], colors[surface], `${name} ${text}/${surface}`);
                }
            }
            checkContrast(colors.onPrimary, colors.primary, `${name} button`);
            checkContrast(colors.onPrimary, colors.primaryHover, `${name} hovered button`);
        }
    } }
];
