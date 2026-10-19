import styled from 'styled-components';

import { useAuth } from '../../hooks/authContext';
import { useState, useSyncExternalStore } from 'react';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import Dialog from '../ui/Dialog';
import { ErrorText, SecondaryButton } from '../ui/formStyles';

const Container = styled.header`
    height: ${({ theme }) => theme.layout.headerHeight};
    background: ${({ theme }) => theme.colors.header};

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 20px;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Logo = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;

    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;

    user-select: none;
`;

const LogoMark = styled.div`
    width: 13px;
    height: 13px;

    border-radius: 3px;

    background: ${({ theme }) => theme.colors.primary};

    transform: rotate(45deg);

    animation: logoPulse 2.8s ease-in-out infinite;

    @keyframes logoPulse {
        0% {
            transform: rotate(45deg) scale(1);

            box-shadow:
                    0 0 6px ${({ theme }) => theme.colors.primary};
        }

        50% {
            transform: rotate(45deg) scale(1.15);

            box-shadow:
                    0 0 18px ${({ theme }) => theme.colors.primary},
                    0 0 30px ${({ theme }) => theme.colors.primary};
        }

        100% {
            transform: rotate(45deg) scale(1);

            box-shadow:
                    0 0 6px ${({ theme }) => theme.colors.primary};
        }
    }
`;

const LogoText = styled.div`
    display: flex;
    align-items: center;
`;

const Forge = styled.span`
    color: ${({ theme }) => theme.colors.text};
`;

const Flow = styled.span`
    color: ${({ theme }) => theme.colors.primary};
`;

const Right = styled.div`
    display: flex;
    align-items: center;
    gap: 15px;

    color: ${({ theme }) => theme.colors.textSecondary};
`;

export default function Header({ unsavedSettings = false }: { unsavedSettings?: boolean }) {
    const auth = useAuth();
    const store = useWorkspacePersistence();
    const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const [confirmLogout, setConfirmLogout] = useState(false);
    return (
        <Container>
            <Logo>
                <LogoMark />

                <LogoText>
                    <Forge>Forge</Forge>
                    <Flow>Flow</Flow>
                </LogoText>
            </Logo>

            <Right>
                {auth.user ? <><span>{auth.user.name || auth.user.email}</span><SecondaryButton disabled={auth.busy} onClick={() => {
                    if (unsavedSettings || workspace.status === 'saving' || workspace.error) setConfirmLogout(true);
                    else void auth.logout();
                }}>Abmelden</SecondaryButton>
                    {auth.error && <ErrorText role="alert">{auth.error}</ErrorText>}</> : <span>Lokale Sitzung</span>}
            </Right>
            {confirmLogout && <Dialog title="Mit ungespeicherten Änderungen abmelden?" onClose={() => { if (!auth.busy) setConfirmLogout(false); }}>
                <p>Es gibt noch nicht bestätigte Änderungen. Beim Abmelden werden lokale Daten und offene Entwürfe entfernt.</p>
                {auth.error && <ErrorText role="alert">{auth.error}</ErrorText>}
                <SecondaryButton disabled={auth.busy} onClick={() => setConfirmLogout(false)}>Zurück</SecondaryButton>{' '}
                <SecondaryButton disabled={auth.busy} onClick={() => void auth.logout()}>Trotzdem abmelden</SecondaryButton>
            </Dialog>}
        </Container>
    );
}
