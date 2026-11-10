import { useTranslation as useUiTranslation } from '../../hooks/languageContext';
import styled from 'styled-components';

const Mark = styled.i<{ $app: 'knowledgeHub' | 'flowPilot' | 'pulseWatch' | 'dataScout' }>`
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px;
    background: ${({ $app }) => $app === 'dataScout' ? '#cee59a' : $app === 'flowPilot' ? '#83dfc2' : $app === 'pulseWatch' ? '#67e8c3' : '#a9a0ff'};
    color: ${({ $app }) => $app === 'dataScout' ? '#203c25' : $app === 'flowPilot' ? '#13252b' : $app === 'pulseWatch' ? '#102d29' : '#17132b'};
    font: 650 17px system-ui, sans-serif;
    letter-spacing: ${({ $app }) => $app === 'flowPilot' ? '-3px' : 'normal'};
    padding-right: ${({ $app }) => $app === 'flowPilot' ? '3px' : '0'};
    b { color: #2c695c; font-weight: inherit; }
`;

export default function AppBrand({ app }: { app: 'knowledgeHub' | 'flowPilot' | 'pulseWatch' | 'dataScout' }) {
    const { t: tx } = useUiTranslation();

    return <Mark $app={app} aria-hidden="true">{app === 'flowPilot' ? <>{tx('f')}<b>{tx('p')}</b></> : app === 'dataScout' ? 'd.' : app === 'pulseWatch' ? tx('p') : tx('K')}</Mark>;
}
