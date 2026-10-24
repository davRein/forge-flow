import { css, keyframes } from 'styled-components';

export const surface = css`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.header};
    box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const button = css`
    min-height: 36px;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;

    &:disabled { cursor: not-allowed; opacity: 0.5; }
`;

export const primaryButton = css`
    ${button}
    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};
    &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.primaryHover}; }
    &:active:not(:disabled) { box-shadow: inset 0 2px 3px rgb(0 0 0 / 14%); }
`;

export const secondaryButton = css`
    ${button}
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.header};
    border-color: ${({ theme }) => theme.colors.border};
    &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.surfaceHover}; border-color: ${({ theme }) => theme.colors.borderStrong}; }
`;

export const control = css`
    min-height: 38px;
    border: 1px solid ${({ theme }) => theme.colors.borderStrong};
    border-radius: 6px;
    padding: 8px 10px;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.header};
    font-weight: 400;
    font-size: 14px;
    line-height: 1.5;
    &:focus-visible { border-color: ${({ theme }) => theme.colors.primary}; outline-offset: 1px; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export const enter = keyframes`
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
`;
