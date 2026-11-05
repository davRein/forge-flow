import { useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../hooks/authContext';
import { ErrorText, Field, FormCard, Input, PrimaryButton, SecondaryButton } from '../../components/ui/formStyles';
import { enter } from '../../styles/primitives';
import { useTranslation } from '../../hooks/languageContext';
import BrandMark from '../../components/layout/BrandMark';

const Page = styled.main`
    display: grid;
    place-items: center;
    height: 100dvh;
    overflow: auto;
    padding: 24px;
    background: ${({ theme }) => theme.colors.content};
    form {
        width: min(100%, 440px);
        padding: 36px;
        box-shadow: ${({ theme }) => theme.shadows.raised};
        animation: ${enter} var(--motion-normal) var(--ease-out);
    }
    h1 { font-size: 24px; margin: 0; min-width: 0; line-height: 1.3; }
    p { margin-bottom: 24px; }
    p:not([role='alert']) { color: ${({ theme }) => theme.colors.textSecondary}; }
    label { margin-bottom: 18px; }
    button[type='submit'] { width: 100%; margin-top: 8px; }
    @media (max-width: 560px) { form { padding: 24px; } }
`;
const Heading = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
`;
export default function LoginPage() {
    const auth = useAuth();
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [trial, setTrial] = useState(false);
    return <Page>{auth.status === 'checking' ? <p role="status">{t('Sitzung wird geprüft …')}</p> : <FormCard as="form" onSubmit={async (event) => {
        event.preventDefault(); await auth.login(email, password, trial); setPassword('');
    }}>
        <Heading><BrandMark size={40} /><h1>{t('Bei ForgeFlow anmelden')}</h1></Heading>
        <p>{t(trial ? 'Testkonto mit eigener E-Mail und Passwort anlegen. Konto, Daten und Rechte werden nach sechs Stunden automatisch gelöscht.' : 'Melde dich mit deinem Benutzerkonto an.')}</p>
        {auth.notice && <p role="status">{t(auth.notice)}</p>}
        <Field>{t('E-Mail')}<Input required type="email" autoComplete="username" autoFocus value={email} disabled={auth.busy} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field>{t('Passwort')}<Input required type="password" minLength={trial ? 12 : undefined} autoComplete={trial ? 'new-password' : 'current-password'} value={password} disabled={auth.busy} onChange={(event) => setPassword(event.target.value)} /></Field>
        {auth.error && <ErrorText role="alert">{t(auth.error)}</ErrorText>}
        <PrimaryButton type="submit" disabled={auth.busy}>{t(auth.busy ? 'Anmeldung läuft …' : trial ? 'Testkonto anlegen' : 'Anmelden')}</PrimaryButton>{' '}
        <SecondaryButton type="button" disabled={auth.busy} style={{ width: '100%', marginTop: 12 }} onClick={() => { setTrial(!trial); setPassword(''); }}>{t(trial ? 'Zur Anmeldung' : 'Testkonto für 6 Stunden anlegen')}</SecondaryButton>
        {auth.status === 'error' && <SecondaryButton type="button" onClick={() => void auth.refresh()}>{t('Sitzung erneut prüfen')}</SecondaryButton>}
    </FormCard>}</Page>;
}
