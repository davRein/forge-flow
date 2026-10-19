import { useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../hooks/authContext';
import { ErrorText, Field, FormCard, Input, PrimaryButton, SecondaryButton } from '../../components/ui/formStyles';

const Page = styled.main`
    display: grid; place-items: center; min-height: 100dvh; overflow: auto; padding: 24px;
    form { width: min(100%, 440px); }
    h1, p, label { margin-bottom: 18px; }
`;
export default function LoginPage() {
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    return <Page>{auth.status === 'checking' ? <p role="status">Sitzung wird geprüft …</p> : <FormCard as="form" onSubmit={async (event) => {
        event.preventDefault(); await auth.login(email, password); setPassword('');
    }}>
        <h1>Bei ForgeFlow anmelden</h1>
        <p>Melde dich mit deinem Benutzerkonto an.</p>
        {auth.notice && <p role="status">{auth.notice}</p>}
        <Field>E-Mail<Input required type="email" autoComplete="username" autoFocus value={email} disabled={auth.busy} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field>Passwort<Input required type="password" autoComplete="current-password" value={password} disabled={auth.busy} onChange={(event) => setPassword(event.target.value)} /></Field>
        {auth.error && <ErrorText role="alert">{auth.error}</ErrorText>}
        <PrimaryButton type="submit" disabled={auth.busy}>{auth.busy ? 'Anmeldung läuft …' : 'Anmelden'}</PrimaryButton>{' '}
        {auth.status === 'error' && <SecondaryButton type="button" onClick={() => void auth.refresh()}>Sitzung erneut prüfen</SecondaryButton>}
    </FormCard>}</Page>;
}
