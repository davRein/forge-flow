import { useTranslation as useUiTranslation } from '../../hooks/languageContext';
import styled from 'styled-components';

const Mark = styled.i<{ $flow: boolean }>`
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px;
    background: ${({ $flow }) => $flow ? '#83dfc2' : '#a9a0ff'};
    color: ${({ $flow }) => $flow ? '#13252b' : '#17132b'};
    font: 650 17px system-ui, sans-serif;
    letter-spacing: ${({ $flow }) => $flow ? '-3px' : 'normal'};
    padding-right: ${({ $flow }) => $flow ? '3px' : '0'};
    b { color: #2c695c; font-weight: inherit; }
`;

export default function AppBrand({ app }: { app: 'knowledgeHub' | 'flowPilot' }) {
    const { t: tx } = useUiTranslation();

    return <Mark $flow={app === 'flowPilot'} aria-hidden="true">{app === 'flowPilot' ? <>{tx('f')}<b>{tx('p')}</b></> : tx('K')}</Mark>;
}
