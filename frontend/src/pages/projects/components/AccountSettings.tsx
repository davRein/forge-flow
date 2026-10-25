import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../../hooks/authContext';
import { useWorkspacePersistence } from '../../../hooks/workspaceContext';
import { apiClient } from '../../../services/api/runtime';
import type { ApiClient } from '../../../services/api/apiClient';
import { useSettingsText } from '../../../hooks/languageContext';
import { createAccountRepository, passwordError, ACCOUNT_LIST_CHANGED_EVENT } from '../../../services/auth/accountRepository';
import type { ManagedAccount } from '../../../services/auth/accountRepository';
import { DangerButton, ErrorText, Field, FormActions, FormCard, FormGrid, Input, PrimaryButton, SecondaryButton } from '../../../components/ui/formStyles';
import Dialog from '../../../components/ui/Dialog';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import { useUnsavedChanges } from '../../../hooks/navigationGuard';

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
type AccountAction = 'profile' | 'password' | 'create' | 'active';

export default function AccountSettings({ unsavedSettings, client = apiClient }: { unsavedSettings: boolean; client?: ApiClient }) {
    const t = useSettingsText();
    const auth = useAuth();
    const workspaceStore = useWorkspacePersistence();
    const workspace = useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getSnapshot);
    const repository = useMemo(() => createAccountRepository(client, auth.epoch), [client, auth.epoch]);
    const [name, setName] = useState(auth.user?.name ?? '');
    const [email, setEmail] = useState(auth.user?.email ?? '');
    const [profilePassword, setProfilePassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [action, setAction] = useState<AccountAction | null>(null);
    const [attempt, setAttempt] = useState(0);
    const feedbackId = useId();
    const feedbackRef = useRef<HTMLParagraphElement>(null);
    const [users, setUsers] = useState<ManagedAccount[]>([]);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [userConfirmation, setUserConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    const [target, setTarget] = useState<ManagedAccount | null>(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const refresh = () => setReload(value => value + 1);
        window.addEventListener(ACCOUNT_LIST_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(ACCOUNT_LIST_CHANGED_EVENT, refresh);
    }, []);
    useChatNavigationBlocker(busy || name !== (auth.user?.name ?? '') || email !== (auth.user?.email ?? '')
        || !!(profilePassword || currentPassword || newPassword || confirmation || newName || newEmail || userPassword || userConfirmation));
    const pendingData = unsavedSettings || workspace.status === 'saving' || !!workspace.error;
    useUnsavedChanges(name !== (auth.user?.name ?? '') || email !== (auth.user?.email ?? '') || !!(profilePassword || currentPassword || newPassword || confirmation || newName || newEmail || userPassword || userConfirmation), () => {
        setName(auth.user?.name ?? ''); setEmail(auth.user?.email ?? ''); setProfilePassword(''); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setNewName(''); setNewEmail(''); setUserPassword(''); setUserConfirmation(''); setTarget(null); setError(null);
    }, busy || auth.busy);
    const disabled = auth.busy || busy || pendingData;
    const feedbackError = error ?? (action === 'profile' || action === 'password' ? auth.error : null);

    useEffect(() => {
        if (feedbackError || message) feedbackRef.current?.focus();
    }, [feedbackError, message, attempt]);

    useEffect(() => {
        if (!auth.user?.administrator) return;
        const controller = new AbortController();
        setLoading(true); setListError(null);
        repository.list(controller.signal).then((result) => {
            if (!controller.signal.aborted) setUsers(result);
        }).catch((reason: unknown) => {
            if (!controller.signal.aborted) setListError(reason instanceof Error ? reason.message : 'Konten konnten nicht geladen werden.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [auth.user?.administrator, repository, reload]);

    if (!auth.user) return <FormCard><p>{t('Die Nutzerverwaltung setzt eine Anmeldung am Backend voraus.')}</p></FormCard>;
    const changedEmail = email.trim().toLowerCase() !== auth.user.email.toLowerCase();

    function begin(next: AccountAction) {
        setAction(next); setAttempt((value) => value + 1);
        setError(null); setMessage(null);
    }

    function feedbackFor(targetAction: AccountAction) {
        if (action !== targetAction) return null;
        if (feedbackError) return <ErrorText id={feedbackId} ref={feedbackRef} role="alert" tabIndex={-1}>{t(feedbackError)}</ErrorText>;
        if (message) return <p id={feedbackId} ref={feedbackRef} role="status" tabIndex={-1}>{t(message)}</p>;
        return null;
    }

    const blockedHint = pendingData && <p role="status">{t('Bitte zuerst ausstehende Änderungen speichern, bevor du Kontodaten änderst.')}</p>;

    async function updateProfile(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        begin('profile');
        if (await auth.updateProfile({ name, email, currentPassword: profilePassword })) { setName(name.trim()); setEmail(email.trim().toLowerCase()); setMessage('Profil gespeichert.'); }
        setProfilePassword('');
    }

    async function updatePassword(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        begin('password');
        const validation = passwordError(newPassword, confirmation);
        if (validation) { setError(validation); return; }
        if (await auth.changePassword(currentPassword, newPassword)) {
            setCurrentPassword(''); setNewPassword(''); setConfirmation('');
        }
    }

    async function createUser(event: FormEvent) {
        event.preventDefault();
        if (disabled) return;
        begin('create');
        const validation = passwordError(userPassword, userConfirmation);
        if (validation) { setError(validation); return; }
        setBusy(true);
        try {
            const user = await repository.create({ name: newName.trim(), email: newEmail.trim(), password: userPassword });
            setUsers((current) => [...current, user].sort((a, b) => a.email.localeCompare(b.email)));
            setNewName(''); setNewEmail('');
            setUserPassword(''); setUserConfirmation('');
            setMessage('Benutzerkonto angelegt.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Konto konnte nicht angelegt werden.'); }
        finally { setBusy(false); }
    }

    async function changeActive() {
        if (!target || disabled) return;
        begin('active');
        setBusy(true);
        try {
            const result = await repository.setActive(target.id, !target.active);
            setUsers((current) => current.map((user) => user.id === result.id ? result : user));
            setTarget(null);
            setMessage(result.active ? 'Benutzerkonto wieder aktiviert.' : 'Benutzerkonto deaktiviert. Die gespeicherten Daten bleiben erhalten.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kontostatus konnte nicht geändert werden.'); }
        finally { setBusy(false); }
    }

    return <section aria-label={t('Benutzerkonto')}>
        {pendingData && <p role="status">{t('Bitte zuerst ausstehende Änderungen speichern, bevor du Kontodaten änderst.')}</p>}
        <Section as="form" aria-label={t('Mein Profil')} aria-busy={auth.busy && action === 'profile'} onSubmit={(event) => void updateProfile(event)}>
            <h2>{t('Mein Profil')}</h2>
            <FormGrid>
                <Field>{t('Name')}<Input required maxLength={1000} autoComplete="name" value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} /></Field>
                <Field>{t('E-Mail')}<Input required type="email" maxLength={254} autoComplete="username" value={email} disabled={disabled} onChange={(event) => setEmail(event.target.value)} /></Field>
                {changedEmail && <Field>{t('Aktuelles Passwort zur Bestätigung')}<Input required type="password" autoComplete="current-password" value={profilePassword} disabled={disabled} onChange={(event) => setProfilePassword(event.target.value)} /></Field>}
            </FormGrid>
            {changedEmail && <p>{t('Nach einer Änderung der E-Mail-Adresse werden andere Sitzungen abgemeldet.')}</p>}
            {feedbackFor('profile')}
            {blockedHint}
            <FormActions><PrimaryButton type="submit" disabled={disabled || (!changedEmail && name.trim() === auth.user.name)}>{auth.busy && action === 'profile' ? t('Profil wird gespeichert …') : t('Profil speichern')}</PrimaryButton></FormActions>
        </Section>
        <Section as="form" aria-label={t('Passwort ändern')} aria-busy={auth.busy && action === 'password'} onSubmit={(event) => void updatePassword(event)}>
            <h2>{t('Passwort ändern')}</h2>
            <p>{t('Mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes. Danach meldest du dich mit dem neuen Passwort erneut an.')}</p>
            <FormGrid>
                <Field>{t('Aktuelles Passwort')}<Input required type="password" autoComplete="current-password" aria-describedby={action === 'password' && feedbackError ? feedbackId : undefined} value={currentPassword} disabled={disabled} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
                <Field>{t('Neues Passwort')}<Input required type="password" autoComplete="new-password" aria-describedby={action === 'password' && feedbackError ? feedbackId : undefined} value={newPassword} disabled={disabled} onChange={(event) => setNewPassword(event.target.value)} /></Field>
                <Field>{t('Neues Passwort wiederholen')}<Input required type="password" autoComplete="new-password" aria-describedby={action === 'password' && feedbackError ? feedbackId : undefined} value={confirmation} disabled={disabled} onChange={(event) => setConfirmation(event.target.value)} /></Field>
            </FormGrid>
            {feedbackFor('password')}
            {blockedHint}
            <FormActions><PrimaryButton type="submit" disabled={disabled}>{auth.busy && action === 'password' ? t('Passwort wird geändert …') : t('Passwort ändern')}</PrimaryButton></FormActions>
        </Section>
        {auth.user.administrator && <>
            <Section>
                <h2>{t('Benutzer verwalten')}</h2>
                <p>{t('Neue Konten starten mit einem eigenen leeren Arbeitsbereich. Deaktivieren beendet den Zugriff und erhält die Daten.')}</p>
                {loading && <p role="status">{t('Konten werden geladen …')}</p>}
                {listError && <ErrorText role="alert">{t(listError)}</ErrorText>}
                {!target && feedbackFor('active')}
                <SecondaryButton type="button" disabled={loading || disabled} onClick={() => setReload((value) => value + 1)}>{t('Kontoliste aktualisieren')}</SecondaryButton>
                <AccountList aria-label={t('Benutzerkonten')}>
                    {users.map((user) => <li key={user.id}>
                        <div><strong>{user.name}</strong><small>{user.email} · {user.administrator ? t('Administrator') : t('Benutzer')} · {user.active ? t('Aktiv') : t('Deaktiviert')}</small></div>
                        {!user.administrator && user.id !== auth.user?.id && <SecondaryButton type="button" disabled={disabled || loading} onClick={() => { begin('active'); setTarget(user); }}>
                            {user.active ? t('Deaktivieren') : t('Aktivieren')}
                        </SecondaryButton>}
                    </li>)}
                </AccountList>
            </Section>
            <Section as="form" aria-label={t('Benutzer anlegen')} aria-busy={busy && action === 'create'} onSubmit={(event) => void createUser(event)}>
                <h2>{t('Benutzer anlegen')}</h2>
                <p>{t('Das Passwort benötigt mindestens 12 Zeichen und höchstens 72 UTF-8-Bytes.')}</p>
                <FormGrid>
                    <Field>{t('Name des neuen Benutzers')}<Input required maxLength={1000} autoComplete="off" value={newName} disabled={disabled} onChange={(event) => setNewName(event.target.value)} /></Field>
                    <Field>{t('E-Mail des neuen Benutzers')}<Input required type="email" maxLength={254} autoComplete="off" value={newEmail} disabled={disabled} onChange={(event) => setNewEmail(event.target.value)} /></Field>
                    <Field>{t('Passwort für das neue Konto')}<Input required type="password" autoComplete="new-password" value={userPassword} disabled={disabled} onChange={(event) => setUserPassword(event.target.value)} /></Field>
                    <Field>{t('Passwort für das neue Konto wiederholen')}<Input required type="password" autoComplete="new-password" value={userConfirmation} disabled={disabled} onChange={(event) => setUserConfirmation(event.target.value)} /></Field>
                </FormGrid>
                {feedbackFor('create')}
                {blockedHint}
                <FormActions><PrimaryButton type="submit" disabled={disabled}>{busy && action === 'create' ? t('Benutzer wird angelegt …') : t('Benutzer anlegen')}</PrimaryButton></FormActions>
            </Section>
        </>}
        {target && <Dialog title={target.active ? t('Benutzerkonto deaktivieren?') : t('Benutzerkonto aktivieren?')} onClose={() => { if (!busy) setTarget(null); }}>
            <p>{target.name} ({target.email}) {target.active ? t('deaktivieren? Bestehende Sitzungen werden ungültig. Die Daten bleiben erhalten.') : t('wieder aktivieren?')}</p>
            {feedbackFor('active')}
            <FormActions>
                <SecondaryButton type="button" disabled={busy} onClick={() => setTarget(null)}>{t('Abbrechen')}</SecondaryButton>
                <DangerButton type="button" disabled={disabled} onClick={() => void changeActive()}>{target.active ? t('Deaktivieren') : t('Aktivieren')}</DangerButton>
            </FormActions>
        </Dialog>}
    </section>;
}
