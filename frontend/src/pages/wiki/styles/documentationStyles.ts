import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Card } from './wikiStyles';

export const DocumentationLayout = styled.div`
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    @media (max-width: 1150px) { grid-template-columns: 210px minmax(0, 1fr); gap: 22px; }
    @media (max-width: 850px) { grid-template-columns: minmax(0, 1fr); }
`;
export const Sidebar = styled.aside`
    position: sticky;
    top: 24px;
    padding: 16px;
    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    min-width: 0;
    max-height: calc(100dvh - 180px);
    overflow: auto;
    h2 { font-size: 13px; font-weight: 650; margin: 24px 0 12px; }
    label { font-size: 12px; margin: 20px 0; }
    ul { list-style: none; padding: 0; }
    ul ul { margin-left: 8px; padding-left: 8px; border-left: 1px solid ${({ theme }) => theme.colors.border}; }
    @media (max-width: 850px) { position: static; max-height: 320px; }
`;
export const SidebarLink = styled(Link)`
    display: block;
    padding: 10px;
    border-radius: 6px;
    text-decoration: none;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 13px;
    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; color: ${({ theme }) => theme.colors.text}; }
    &[aria-current='page'] { background: ${({ theme }) => theme.colors.primarySubtle}; color: ${({ theme }) => theme.colors.primary}; font-weight: 600; }
`;
export const TreeRow = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 2px;
    > a { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 5px; }
    > button { width: 24px; height: 28px; flex-shrink: 0; border: 0; border-radius: 4px; background: transparent; color: ${({ theme }) => theme.colors.textSecondary}; cursor: pointer; }
    > button:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
    > span { width: 24px; flex-shrink: 0; text-align: center; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
export const Main = styled.div`min-width: 0;`;
export const Eyebrow = styled.p`
    color: ${({ theme }) => theme.colors.primary};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .09em;
    text-transform: uppercase;
    margin-bottom: 10px;
`;
export const Hero = styled(Card)`
    padding: 30px;
    margin-bottom: 28px;
    border-top: 3px solid ${({ theme }) => theme.colors.primary};
    h2 { font-size: clamp(24px, 3vw, 32px); letter-spacing: -.035em; line-height: 1.2; }
    > p { max-width: 65ch; }
`;
export const SpaceBadge = styled.span`
    display: inline-grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.primarySubtle};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
`;
export const Breadcrumbs = styled.nav`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: 22px;
    a { color: inherit; text-decoration: none; }
    a:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
`;
export const ReadingLayout = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 170px;
    gap: 30px;
    align-items: start;
    > article { min-width: 0; }
    > nav { position: sticky; top: 24px; border-left: 1px solid ${({ theme }) => theme.colors.border}; padding-left: 16px; }
    > nav h3 { font-size: 12px; margin-bottom: 12px; }
    > nav button { display: block; border: 0; background: transparent; color: ${({ theme }) => theme.colors.textSecondary}; font: inherit; font-size: 12px; text-align: left; padding: 6px 0; cursor: pointer; overflow-wrap: anywhere; }
    > nav button:hover { color: ${({ theme }) => theme.colors.primary}; }
    @media (max-width: 1200px) { grid-template-columns: minmax(0, 1fr); > nav { position: static; grid-row: 1; } }
`;
export const ReadingCard = styled(Card)`
    padding: clamp(20px, 3vw, 42px);
    > h2 { font-size: clamp(26px, 3vw, 36px); line-height: 1.2; letter-spacing: -.035em; margin: 12px 0; }
`;
export const FormattingBar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    padding: 8px;
    border-radius: 8px;
    margin-bottom: 12px;
    background: ${({ theme }) => theme.colors.content};
    button { border: 0; background: transparent; color: ${({ theme }) => theme.colors.text}; padding: 7px 9px; border-radius: 5px; cursor: pointer; font: inherit; font-size: 12px; }
    button:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
`;
