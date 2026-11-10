export function showcaseProjectUrl(configured: string | undefined, developmentUrl: string, development: boolean): string | null {
    try {
        const url = new URL(configured === undefined && development ? developmentUrl : configured?.trim() ?? '');
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password) return null;
        return url.href;
    } catch { return null; }
}

// The production target is protected by live suite authentication and tenant storage.
export function dataScoutUrl(configured: string | undefined, development: boolean): string | null {
    if (!development) return configured === 'https://forge-flow.de/datascout/' ? configured : null;
    const value = configured === undefined ? 'http://localhost:5176' : configured.trim();
    return ['http://localhost:5176', 'http://localhost:5176/', 'http://127.0.0.1:5176', 'http://127.0.0.1:5176/'].includes(value) ? new URL(value).href : null;
}

export const showcaseProjects = [
    { key: 'knowledgeHub', label: 'AI Knowledge Hub', mark: 'K', url: showcaseProjectUrl(import.meta.env.VITE_KNOWLEDGE_HUB_URL, 'http://localhost:3000', import.meta.env.DEV), sections: ['chat', 'documents', 'account', 'privacy'] },
    { key: 'flowPilot', label: 'FlowPilot', mark: 'fp', url: showcaseProjectUrl(import.meta.env.VITE_FLOWPILOT_URL, 'http://localhost:5174', import.meta.env.DEV), sections: ['overview', 'workflows', 'runs', 'integrations', 'jobs'] },
    { key: 'pulseWatch', label: 'PulseWatch', mark: 'p', url: showcaseProjectUrl(import.meta.env.VITE_PULSEWATCH_URL, 'http://localhost:5177', import.meta.env.DEV), sections: ['overview'] },
    { key: 'dataScout', label: 'DataScout', mark: 'd.', url: dataScoutUrl(import.meta.env.VITE_DATASCOUT_URL, import.meta.env.DEV), sections: ['dashboard', 'collection', 'jobs'] }
] as const;

export type ShowcaseApp = typeof showcaseProjects[number]['key'];

export function showcaseAccess(administrator: boolean | undefined, restricted = import.meta.env.VITE_SHOWCASE_ADMIN_ONLY === 'true'): boolean {
    return !restricted || administrator === true;
}

export function suiteMessage(value: unknown): { type: 'hello' | 'ready' | 'route'; section: string } | null {
    if (!value || typeof value !== 'object' || !('channel' in value) || value.channel !== 'forgeflow-suite'
        || !('type' in value) || !['hello', 'ready', 'route'].includes(String(value.type))
        || !('section' in value) || typeof value.section !== 'string') return null;
    return { type: value.type as 'hello' | 'ready' | 'route', section: value.section };
}
