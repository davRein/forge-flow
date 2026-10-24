import styled from 'styled-components';
import { control, primaryButton, secondaryButton, surface } from '../../styles/primitives';

// Shared form controls used across modules.

export const FormCard = styled.div`
    ${surface}
    padding: 24px;
    margin-bottom: 20px;
`;

export const FormHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 18px;
`;

export const CloseButton = styled.button`
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;

    width: 32px;
    height: 32px;
    border-radius: 6px;
    font-size: 24px;
    line-height: 1;

    &:hover {
        color: ${({ theme }) => theme.colors.text};
        background: ${({ theme }) => theme.colors.surfaceHover};
    }
`;

export const FormGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;

    @media (max-width: 720px) {
        grid-template-columns: 1fr;
    }
`;

export const Field = styled.label`
    display: flex;
    flex-direction: column;
    gap: 6px;

    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 13px;
    font-weight: 600;
`;

export const Required = styled.span`
    color: ${({ theme }) => theme.colors.danger};
`;

export const Input = styled.input`
    ${control}
`;

export const Select = styled.select`
    ${control}
`;

export const FormActions = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;

    margin-top: 18px;
`;

export const PrimaryButton = styled.button`
    ${primaryButton}
`;

export const SecondaryButton = styled.button`
    ${secondaryButton}
`;

export const DangerButton = styled(SecondaryButton)`
    color: ${({ theme }) => theme.colors.danger};
    border-color: ${({ theme }) => theme.colors.dangerBorder};
    &:hover:not(:disabled) { color: ${({ theme }) => theme.colors.dangerHover}; border-color: ${({ theme }) => theme.colors.danger}; }
`;

export const ErrorText = styled.p`
    color: ${({ theme }) => theme.colors.danger};
`;

export const CheckboxRow = styled.label`
    display: flex;
    align-items: center;
    gap: 10px;

    margin-top: 16px;
    color: ${({ theme }) => theme.colors.textSecondary};
`;
