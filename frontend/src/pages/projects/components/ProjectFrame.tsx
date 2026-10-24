import styled from 'styled-components';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../hooks/languageContext';
import ProjectToolbar from './ProjectToolbar';

const Frame = styled.section`
    min-width: 0;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.header};
`;
const Content = styled.div`padding: 6px; min-width: 0;`;

type Props = { query: string; onQueryChange: (query: string) => void; onNew: () => void; count: number; total: number; children: ReactNode };

export default function ProjectFrame({ children, ...toolbar }: Props) {
    const { t } = useTranslation();
    return <Frame aria-label={t('Projektübersicht')}><ProjectToolbar {...toolbar} /><Content>{children}</Content></Frame>;
}
