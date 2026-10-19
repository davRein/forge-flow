export function getBadgeTextColor(color: string, mode: 'dark' | 'light') {
    if (mode === 'dark' || !/^#[\da-f]{6}$/i.test(color)) return color;
    const channels = [1, 3, 5].map((offset) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.5)
        .toString(16).padStart(2, '0'));
    return `#${channels.join('')}`;
}
