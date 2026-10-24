import type { ModuleKey } from '../../config/moduleConfig';

const paths: Record<ModuleKey, string> = {
    projectManager: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    wiki: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5z',
    devTools: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18'
};

export default function ModuleIcon({ moduleKey }: { moduleKey: ModuleKey }) {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[moduleKey]} /></svg>;
}
