import styled from 'styled-components';

// Shared form controls used across modules.

export const FormCard = styled.div`
    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    padding: 20px;
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
    color: ${({ theme }) => theme.colors.danger};
    cursor: pointer;

    font-size: 26px;
    line-height: 1;

    &:hover {
        color: ${({ theme }) => theme.colors.dangerHover};
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
    font-size: 14px;
`;

export const Required = styled.span`
    color: ${({ theme }) => theme.colors.danger};
`;

export const Input = styled.input`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px;

    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
`;

export const Select = styled.select`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px;

    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
`;

export const FormActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;

    margin-top: 18px;
`;

export const PrimaryButton = styled.button`
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};

    font-weight: 700;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

export const SecondaryButton = styled.button`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.text};
    background: transparent;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

export const DangerButton = styled(SecondaryButton)`
    color: ${({ theme }) => theme.colors.danger};
    border-color: ${({ theme }) => theme.colors.dangerBorder};
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
