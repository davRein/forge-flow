import type { ModuleKey } from '../../config/moduleConfig';
import styled from 'styled-components';
import AppBrand from './AppBrand';

type StandardModule = Exclude<ModuleKey, 'knowledgeHub' | 'flowPilot' | 'pulseWatch' | 'dataScout'>;

const iconColors: Record<StandardModule, { background: string; foreground: string }> = {
    projectManager: { background: '#a9caff', foreground: '#17365d' },
    git: { background: '#ffbaab', foreground: '#622e22' },
    wiki: { background: '#f2d48c', foreground: '#574016' },
    devTools: { background: '#c9b8f2', foreground: '#3f2c64' },
    requestLab: { background: '#a9dfd2', foreground: '#174c41' },
    timeTracker: { background: '#9adce5', foreground: '#1c4850' },
    business: { background: '#efbf98', foreground: '#57371f' },
    cloud: { background: '#b3d5ef', foreground: '#26445b' },
    settings: { background: '#c7cedb', foreground: '#344054' }
};

const IconBox = styled.i<{ $module: StandardModule }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: ${({ $module }) => iconColors[$module].background};
    color: ${({ $module }) => iconColors[$module].foreground};
`;

const paths: Record<Exclude<ModuleKey, 'knowledgeHub' | 'flowPilot' | 'pulseWatch' | 'dataScout'>, string> = {
    projectManager: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    wiki: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5z',
    devTools: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
    requestLab: 'M4 7h13m-4-4 4 4-4 4M20 17H7m4-4-4 4 4 4',
    timeTracker: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
    business: 'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',
    cloud: 'M7 18h11a4 4 0 0 0 .5-8A6.5 6.5 0 0 0 6 8.5 4.8 4.8 0 0 0 7 18z',
    git: 'M6 3v12a4 4 0 0 0 4 4h8 M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 3v6a4 4 0 0 1-4 4H6',
    settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'
};

export default function ModuleIcon({ moduleKey, boxed = false }: { moduleKey: ModuleKey; boxed?: boolean }) {
    if (moduleKey === 'knowledgeHub' || moduleKey === 'flowPilot' || moduleKey === 'pulseWatch' || moduleKey === 'dataScout') return <AppBrand app={moduleKey} />;
    const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[moduleKey]} /></svg>;
    return boxed ? <IconBox $module={moduleKey} aria-hidden="true">{icon}</IconBox> : icon;
}
