import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../../hooks/authContext';
import { useWorkspacePersistence } from '../../../hooks/workspaceContext';
import { apiClient } from '../../../services/api/runtime';
import { createAccountRepository, passwordError } from '../../../services/auth/accountRepository';
import type { ManagedAccount } from '../../../services/auth/accountRepository';
import { DangerButton, ErrorText, Field, FormActions, FormCard, FormGrid, Input, PrimaryButton, SecondaryButton } from '../../../components/ui/formStyles';
import Dialog from '../../../components/ui/Dialog';

const Section = styled(FormCard)`
    max-width: 850px;
    h2 { margin-bottom: 12px; font-size: 20px; }
    p { margin-bottom: 16px; line-height: 1.6; }
`;
const AccountList = styled.ul`
    list-style: none;
    padding: 0;
    li {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    }
    small { display: block; margin-top: 6px; color: ${({ theme }) => theme.colors.textSecondary}; }
`;

export default function AccountSettings({ unsavedSettings }: { unsavedSettings: boolean }) {
    const auth = useAuth();
    const workspaceStore = useWorkspacePersistence();
    const workspace = useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getSnapshot);
    const repository = useMemo(() => createAccountRepository(apiClient, auth.epoch), [auth.epoch]);
    const [name, setName] = useState(auth.user?.name ?? '');
    const [email, setEmail] = useState(auth.user?.email ?? '');
    const [profilePassword, setProfilePassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [users, setUsers] = useState<ManagedAccount[]>([]);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [userConfirmation, setUserConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [target, setTarget] = useState<ManagedAccount | null>(null);
    const [reload, setReload] = useState(0);
    const pendingData = unsavedSettings || workspace.status === 'saving' || !!workspace.error;
    const disabled = auth.busy || busy || pendingData;

    useEffect(() => {
        if (!auth.user?.administrator) return;
        const controller = new AbortController();
        setLoading(true);
        repository.list(controller.signal).then((result) => {
            if (!controller.signal.aborted) { setUsers(result); setError(null); }
        }).catch((reason: unknown) => {
            if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Konten konnten nicht geladen werden.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [auth.user?.administrator, repository, reload]);

    if (!auth.user) return null;
    const changedEmail = email.trim().toLowerCase() !== auth.user.email.toLowerCase();

    async function updateProfile(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        setError(null); setMessage(null);
        await auth.updateProfile({ name, email, currentPassword: profilePassword });
        setProfilePassword('');
    }

    async function updatePassword(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        const validation = passwordError(newPassword, confirmation);
        setError(validation); setMessage(null);
        if (validation) return;
        await auth.changePassword(currentPassword, newPassword);
        setCurrentPassword(''); setNewPassword(''); setConfirmation('');
    }

    async function createUser(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        const validation = passwordError(userPassword, userConfirmation);
        setError(validation); setMessage(null);
        if (validation) return;
        setBusy(true);
        try {
            const user = await repository.create({ name: newName.trim(), email: newEmail.trim(), password: userPassword });
            setUsers((current) => [...current, user].sort((a, b) => a.email.localeCompare(b.email)));
            setNewName(''); setNewEmail('');
            setMessage('Benutzerkonto angelegt.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Konto konnte nicht angelegt werden.'); }
        finally { setUserPassword(''); setUserConfirmation(''); setBusy(false); }
    }

    async function changeActive() {
        if (!target || disabled) return;
        setBusy(true); setError(null); setMessage(null);
        try {
            const result = await repository.setActive(target.id, !target.active);
            setUsers((current) => current.map((user) => user.id === result.id ? result : user));
            setTarget(null);
            setMessage(result.active ? 'Benutzerkonto wieder aktiviert.' : 'Benutzerkonto deaktiviert. Die gespeicherten Daten bleiben erhalten.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kontostatus konnte nicht geändert werden.'); }
        finally { setBusy(false); }
    }

    return <section aria-label="Benutzerkonto">
        {pendingData && <p role="status">Bitte zuerst ausstehende Änderungen speichern, bevor du Kontodaten änderst.</p>}
        {error && <ErrorText role="alert">{error}</ErrorText>}
        {message && <p role="status">{message}</p>}
        <Section as="form" onSubmit={(event) => void updateProfile(event)}>
            <h2>Mein Profil</h2>
            <FormGrid>
                <Field>Name<Input required maxLength={1000} autoComplete="name" value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} /></Field>
                <Field>E-Mail<Input required type="email" maxLength={254} autoComplete="username" value={email} disabled={disabled} onChange={(event) => setEmail(event.target.value)} /></Field>
                {changedEmail && <Field>Aktuelles Passwort zur Bestätigung<Input required type="password" autoComplete="current-password" value={profilePassword} disabled={disabled} onChange={(event) => setProfilePassword(event.target.value)} /></Field>}
            </FormGrid>
            {changedEmail && <p>Nach einer Änderung der E-Mail-Adresse werden andere Sitzungen abgemeldet.</p>}
            <FormActions><PrimaryButton disabled={disabled || (!changedEmail && name.trim() === auth.user.name)}>Profil speichern</PrimaryButton></FormActions>
        </Section>
        <Section as="form" onSubmit={(event) => void updatePassword(event)}>
            <h2>Passwort ändern</h2>
            <p>Mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes. Danach meldest du dich mit dem neuen Passwort erneut an.</p>
            <FormGrid>
                <Field>Aktuelles Passwort<Input required type="password" autoComplete="current-password" value={currentPassword} disabled={disabled} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
                <Field>Neues Passwort<Input required type="password" autoComplete="new-password" value={newPassword} disabled={disabled} onChange={(event) => setNewPassword(event.target.value)} /></Field>
                <Field>Neues Passwort wiederholen<Input required type="password" autoComplete="new-password" value={confirmation} disabled={disabled} onChange={(event) => setConfirmation(event.target.value)} /></Field>
            </FormGrid>
            <FormActions><PrimaryButton disabled={disabled}>Passwort ändern</PrimaryButton></FormActions>
        </Section>
        {auth.user.administrator && <>
            <Section>
                <h2>Benutzer verwalten</h2>
                <p>Neue Konten starten mit einem eigenen leeren Arbeitsbereich. Deaktivieren beendet den Zugriff und erhält die Daten.</p>
                {loading && <p role="status">Konten werden geladen …</p>}
                <SecondaryButton type="button" disabled={loading || disabled} onClick={() => setReload((value) => value + 1)}>Kontoliste aktualisieren</SecondaryButton>
                <AccountList aria-label="Benutzerkonten">
                    {users.map((user) => <li key={user.id}>
                        <div><strong>{user.name}</strong><small>{user.email} · {user.administrator ? 'Administrator' : 'Benutzer'} · {user.active ? 'Aktiv' : 'Deaktiviert'}</small></div>
                        {!user.administrator && user.id !== auth.user?.id && <SecondaryButton type="button" disabled={disabled || loading} onClick={() => { setError(null); setTarget(user); }}>
                            {user.active ? 'Deaktivieren' : 'Aktivieren'}
                        </SecondaryButton>}
                    </li>)}
                </AccountList>
            </Section>
            <Section as="form" onSubmit={(event) => void createUser(event)}>
                <h2>Benutzer anlegen</h2>
                <FormGrid>
                    <Field>Name des neuen Benutzers<Input required maxLength={1000} autoComplete="off" value={newName} disabled={disabled} onChange={(event) => setNewName(event.target.value)} /></Field>
                    <Field>E-Mail des neuen Benutzers<Input required type="email" maxLength={254} autoComplete="off" value={newEmail} disabled={disabled} onChange={(event) => setNewEmail(event.target.value)} /></Field>
                    <Field>Passwort für das neue Konto<Input required type="password" autoComplete="new-password" value={userPassword} disabled={disabled} onChange={(event) => setUserPassword(event.target.value)} /></Field>
                    <Field>Passwort für das neue Konto wiederholen<Input required type="password" autoComplete="new-password" value={userConfirmation} disabled={disabled} onChange={(event) => setUserConfirmation(event.target.value)} /></Field>
                </FormGrid>
                <FormActions><PrimaryButton disabled={disabled}>Benutzer anlegen</PrimaryButton></FormActions>
            </Section>
        </>}
        {target && <Dialog title={target.active ? 'Benutzerkonto deaktivieren?' : 'Benutzerkonto aktivieren?'} onClose={() => { if (!busy) setTarget(null); }}>
            <p>{target.name} ({target.email}) {target.active ? 'deaktivieren? Bestehende Sitzungen werden ungültig. Die Daten bleiben erhalten.' : 'wieder aktivieren?'}</p>
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <FormActions>
                <SecondaryButton type="button" disabled={busy} onClick={() => setTarget(null)}>Abbrechen</SecondaryButton>
                <DangerButton type="button" disabled={disabled} onClick={() => void changeActive()}>{target.active ? 'Deaktivieren' : 'Aktivieren'}</DangerButton>
            </FormActions>
        </Dialog>}
    </section>;
}
