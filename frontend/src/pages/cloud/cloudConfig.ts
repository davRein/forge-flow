export const defaultNextcloudUrl = 'https://cloud.forge-flow.de';

export function nextcloudUrl(configured: string | undefined): string | null {
    try {
        const url = new URL(configured === undefined ? defaultNextcloudUrl : configured.trim());
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
        return url.origin;
    } catch { return null; }
}
