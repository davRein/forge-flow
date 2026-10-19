import { ReactNode, useEffect, useId, useRef } from 'react';
import styled from 'styled-components';
import { CloseButton, FormHeader } from './formStyles';

const Surface = styled.dialog`
    width: min(680px, calc(100vw - 40px));
    max-height: calc(100dvh - 40px);
    overflow: auto;
    box-sizing: border-box;
    padding: 24px;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 14px;

    &::backdrop { background: rgba(0, 0, 0, 0.65); }
`;

type Props = { title: string; onClose: () => void; children: ReactNode };

export default function Dialog({ title, onClose, children }: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    return (
        <Surface ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
            <FormHeader>
                <h2 id={titleId}>{title}</h2>
                <CloseButton type="button" aria-label="Dialog schließen" onClick={onClose}>×</CloseButton>
            </FormHeader>
            {children}
        </Surface>
    );
}
