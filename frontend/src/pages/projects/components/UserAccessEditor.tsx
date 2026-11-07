import { useState } from 'react';
import { useTranslation } from '../../../hooks/languageContext';
import type { ManagedAccount } from '../../../services/auth/accountRepository';
import { accountAppCatalog, accountText, decodeUserApps, usernameValid } from '../../../services/auth/userAccess';
import Dialog from '../../../components/ui/Dialog';
import { ErrorText, Field, FormActions, FormGrid, Input, PrimaryButton, SecondaryButton } from '../../../components/ui/formStyles';

export default function UserAccessEditor({ user, save, close, onBusy }: { onBusy(busy: boolean): void; user: ManagedAccount; save(value: { username: string; allowedApps: string[]; sessionVersion: number }): Promise<void>; close(): void }) {
    const { language, t } = useTranslation();
    const a = (key: Parameters<typeof accountText>[1]) => accountText(language, key);
    const [username, setUsername] = useState(user.username ?? '');
    const [apps, setApps] = useState(() => decodeUserApps(user.allowedApps));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return <Dialog title={a('permissions')} onClose={() => { if (!busy) close(); }}>
        <form aria-label={a('permissions')} onSubmit={async event => {
            event.preventDefault(); if (busy) return;
            if (!usernameValid(username)) { setError(a('invalidUsername')); return; }
            setBusy(true); onBusy(true); setError('');
            try { await save({ username: username.trim(), allowedApps: apps, sessionVersion: user.sessionVersion ?? 0 }); }
            catch (failure) { setError(failure instanceof Error ? failure.message : t('Anfrage fehlgeschlagen.')); }
            finally { setBusy(false); onBusy(false); }
        }}>
            <p>{user.name} · {user.email}</p>
            <Field>{a('username')}<Input required minLength={3} maxLength={64} value={username} disabled={busy} onChange={event => setUsername(event.target.value)} /></Field>
            <p>{a('help')}</p>
            <FormGrid>{accountAppCatalog.map(app => <label key={app.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
                <input type="checkbox" checked={apps.includes(app.key)} disabled={busy} onChange={event => setApps(current => event.target.checked ? [...current, app.key] : current.filter(key => key !== app.key))} />{t(app.label)}
            </label>)}</FormGrid>
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <FormActions><SecondaryButton type="button" disabled={busy} onClick={close}>{t('Abbrechen')}</SecondaryButton><PrimaryButton type="submit" disabled={busy}>{t('Speichern')}</PrimaryButton></FormActions>
        </form>
    </Dialog>;
}
