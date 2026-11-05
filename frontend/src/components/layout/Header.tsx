import { useTranslation as useUiTranslation } from '../../hooks/languageContext';
import { useTranslation } from '../../hooks/languageContext';
import styled from 'styled-components';

import { useAuth } from '../../hooks/authContext';
import { useState, useSyncExternalStore } from 'react';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import Dialog from '../ui/Dialog';
import { ErrorText, SecondaryButton } from '../ui/formStyles';
import BrandMark from './BrandMark';
import GlobalSearch from '../GlobalSearch';
import { GuardedLink } from '../navigation/GuardedLink';
import { useLocation } from 'react-router-dom';
import ModuleIcon from './ModuleIcon';
import { useNavigationGuard } from '../../hooks/navigationGuard';

const Left = styled.div`
    display: flex; align-items: center; gap: 16px; min-width: 0;
    > button { white-space: nowrap; flex-shrink: 0; }
    @media(max-width: 560px) { gap: 8px; > button { padding-inline: 8px; } kbd { display: none; } }
`;
const SettingsLink = styled(GuardedLink)`
    display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
    border-radius: 6px; color: ${({ theme }) => theme.colors.textSecondary}; flex-shrink: 0;
    &:hover, &[aria-current='page'] { color: ${({ theme }) => theme.colors.primary}; background: ${({ theme }) => theme.colors.primarySubtle}; }
`;

const Container = styled.header`
    height: ${({ theme }) => theme.layout.headerHeight};
    background: ${({ theme }) => theme.colors.header};

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 24px;
    gap: 16px;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    @media (max-width: 560px) { padding-inline: 12px; gap: 8px; }
`;

const Logo = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    font-size: 21px;
    font-weight: 650;
    letter-spacing: -0.7px;

    user-select: none;
`;

const LogoText = styled.div`
    display: flex;
    align-items: center;
    @media (max-width: 560px) { display: none; }
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
    min-width: 0;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textSecondary};
    > button { white-space: nowrap; }
    @media (max-width: 560px) { gap: 8px; }
`;

const UserName = styled.span`
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @media (max-width: 560px) { display: none; }
`;

const Avatar = styled.span`
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primarySubtle};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 12px;
    font-weight: 650;
`;

export default function Header({ unsavedSettings = false }: { unsavedSettings?: boolean }) {
    const { t: tx } = useUiTranslation();

    const { t, language } = useTranslation();
    const auth = useAuth();
    const guard = useNavigationGuard();
    const location = useLocation();
    const store = useWorkspacePersistence();
    const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const [confirmLogout, setConfirmLogout] = useState(false);
    return (
        <Container lang={language}>
            <Left><Logo>
                <BrandMark />

                <LogoText>
                    <Forge>{tx('Forge')}</Forge>
                    <Flow>{tx('Flow')}</Flow>
                </LogoText>
            </Logo><GlobalSearch /><SettingsLink to="/settings/general" aria-label={t('Globale Einstellungen')} title={t('Globale Einstellungen')} aria-current={location.pathname.startsWith('/settings/') ? 'page' : undefined}><ModuleIcon moduleKey="settings" /></SettingsLink></Left>

            <Right>
                {auth.user?.expiresAt && <span title={t('Testkonto wird automatisch gelöscht.')}>{t('Testkonto bis {time}', { time: new Date(auth.user.expiresAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' }) })}</span>}
                <Avatar aria-hidden="true">{auth.user ? (auth.user.name || auth.user.email).slice(0, 2).toLocaleUpperCase('de') : tx('L')}</Avatar>
                {auth.user ? <><UserName title={auth.user.name || auth.user.email}>{auth.user.name || auth.user.email}</UserName><SecondaryButton disabled={auth.busy} onClick={() => {
                    if (unsavedSettings || workspace.status === 'saving' || workspace.error) setConfirmLogout(true);
                    else guard.request(() => void auth.logout());
                }}>{t('Abmelden')}</SecondaryButton>
                    {auth.error && <ErrorText role="alert">{t(auth.error)}</ErrorText>}</> : <span>{t('Lokale Sitzung')}</span>}
                {auth.notice && <span role="status">{t(auth.notice)}</span>}
            </Right>
            {confirmLogout && <Dialog title={t('Mit ungespeicherten Änderungen abmelden?')} onClose={() => { if (!auth.busy) setConfirmLogout(false); }}>
                <p>{t('Es gibt noch nicht bestätigte Änderungen. Beim Abmelden werden lokale Daten und offene Entwürfe entfernt.')}</p>
                {auth.error && <ErrorText role="alert">{t(auth.error)}</ErrorText>}
                <SecondaryButton disabled={auth.busy} onClick={() => setConfirmLogout(false)}>{t('Zurück')}</SecondaryButton>{' '}
                <SecondaryButton disabled={auth.busy} onClick={() => void auth.logout()}>{t('Trotzdem abmelden')}</SecondaryButton>
            </Dialog>}
        </Container>
    );
}
