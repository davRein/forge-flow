import styled from 'styled-components';
import { primaryButton } from '../../../styles/primitives';

export const Container = styled.div<{ $compact?: boolean }>`
    padding: ${({ $compact }) => $compact ? '24px 28px 32px' : '30px 32px 40px'};
    max-width: ${({ $compact }) => $compact ? '1100px' : '1440px'};
    margin: 0 auto;
    ${({ $compact }) => $compact ? '> div:first-child { margin-bottom: 18px; } > div:first-child h1 { font-size: 24px; letter-spacing: -.4px; }' : ''}
    @media (max-width: 760px) { padding: 22px 16px; }
`;

export const HeaderRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 28px;
`;

export const Title = styled.h1`min-width: 0;`;

export const ResultCount = styled.p`
    margin: 12px 0 20px;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 12px;
`;

export const FilterRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 20px;
    margin-bottom: 24px;
    > label { flex: 1; min-width: min(100%, 220px); max-width: 520px; }
    ${ResultCount} { margin: 0 0 10px; }
`;

export const IconButton = styled.button`
    ${primaryButton}
`;

export const Grid = styled.div`
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
    min-width: 0;
    @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr); }
`;
