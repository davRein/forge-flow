import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { useDeveloper } from '../../../hooks/developerContext';
import { useAuth } from '../../../hooks/authContext';
import { useTranslation } from '../../../hooks/languageContext';
import { useUnsavedChanges } from '../../../hooks/navigationGuard';
import { Actions, Card, Field, FormGrid, Input, Select, PrimaryButton, SecondaryButton, DangerButton, Muted } from '../styles/toolStyles';
import Dialog from '../../../components/ui/Dialog';
import type { Connection } from '../../../services/developer/developer';

const blank = () => ({ id: '', name: '', host: '127.0.0.1', port: 5432, database: '', username: '', sslMode: 'require', password: '' });
export default function DatabaseConnections({ active }: { active: boolean }) {
    const { t: tx } = useUiTranslation();

    const dev = useDeveloper(active); const { t } = useTranslation(); const { user } = useAuth();
    const [open, setOpen] = useState(false); const [form, setForm] = useState(blank); const [base, setBase] = useState(() => JSON.stringify(blank()));
    const [message, setMessage] = useState(''); const [deleting, setDeleting] = useState<Connection | null>(null);
    const reset = () => { setForm(blank()); setBase(JSON.stringify(blank())); setOpen(false); };
    useUnsavedChanges(active && JSON.stringify(form) !== base, reset, active && dev.busy);
    const disabled = !dev.remote || !dev.data.integrationsConfigured || !!user?.expiresAt || dev.busy || dev.status !== 'ready';
    const edit = (value: Connection) => { const next = { id: value.id, name: value.name, host: value.host, port: value.port, database: value.database, username: value.username, sslMode: value.sslMode, password: '' }; setForm(next); setBase(JSON.stringify(next)); setOpen(true); setMessage(''); };
    const run = async (operation: () => Promise<unknown>, success: string) => { setMessage(''); try { await operation(); setMessage(success); } catch { /* Provider displays sanitized error. */ } };
    return <Card>
        <h2>{t('PostgreSQL-Verbindungen')}</h2>
        <Muted>{t('Zugangsdaten werden verschlüsselt auf dem Backend gespeichert. Nur freigegebene Hosts sind erreichbar. Verwende eine Datenbankrolle mit möglichst wenigen Rechten.')}</Muted>
        {user?.expiresAt && <Muted>{t('Testkonten können keine externen Datenbanken oder GitHub-Zugänge verwenden.')}</Muted>}
        {!dev.data.integrationsConfigured && dev.remote && <Muted>{t('Die Administration muss zuerst INTEGRATION_SECRET_KEY konfigurieren.')}</Muted>}
        <Actions><SecondaryButton disabled={disabled || open} onClick={() => { setOpen(true); setMessage(''); }}>{t('Neue Verbindung')}</SecondaryButton></Actions>
        {!open && dev.data.connections.map(value => <Actions key={value.id}>
            <span>{value.name} · {value.host}:{value.port}/{value.database}</span>
            <SecondaryButton disabled={disabled} onClick={() => edit(value)}>{t('Bearbeiten')}</SecondaryButton>
            <SecondaryButton disabled={disabled} onClick={() => void run(() => dev.request(`/connections/${value.id}/test`, {}), 'Verbindung erfolgreich.')}>{t('Verbindung testen')}</SecondaryButton>
            <DangerButton disabled={disabled} onClick={() => setDeleting(value)}>{t('Löschen')}</DangerButton>
        </Actions>)}
        {open && <form onSubmit={event => { event.preventDefault(); void run(async () => { await dev.request('/connections', { ...form, id: form.id || null }, 'POST', true); reset(); }, 'Verbindung gespeichert.'); }}>
            <FormGrid>
                <Field>{t('Name')}<Input required maxLength={200} value={form.name} disabled={disabled} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
                <Field>{t('Host')}<Input required maxLength={253} value={form.host} disabled={disabled} onChange={e => setForm({ ...form, host: e.target.value })} /></Field>
                <Field>{t('Port')}<Input required type="number" min={1} max={65535} value={form.port} disabled={disabled} onChange={e => setForm({ ...form, port: Number(e.target.value) })} /></Field>
                <Field>{t('Datenbank')}<Input required maxLength={63} value={form.database} disabled={disabled} onChange={e => setForm({ ...form, database: e.target.value })} /></Field>
                <Field>{t('Benutzername')}<Input required autoComplete="off" maxLength={128} value={form.username} disabled={disabled} onChange={e => setForm({ ...form, username: e.target.value })} /></Field>
                <Field>{t('Passwort')}<Input type="password" autoComplete="new-password" maxLength={1024} value={form.password} disabled={disabled} onChange={e => setForm({ ...form, password: e.target.value })} />{form.id && <small>{t('Leer lassen, um das gespeicherte Passwort beizubehalten.')}</small>}</Field>
                <Field>{t('TLS')}<Select value={form.sslMode} disabled={disabled} onChange={e => setForm({ ...form, sslMode: e.target.value })}><option value="verify-full">{tx('verify-full')}</option><option value="require">{tx('require')}</option><option value="disable">{t('Deaktiviert (nur lokal)')}</option></Select></Field>
            </FormGrid>
            <Actions><PrimaryButton disabled={disabled} type="submit">{t('Speichern')}</PrimaryButton><SecondaryButton disabled={dev.busy} type="button" onClick={reset}>{t('Abbrechen')}</SecondaryButton></Actions>
        </form>}
        {message && <p role="status">{t(message)}</p>}
        {deleting && <Dialog title={t('Verbindung löschen?')} onClose={() => { if (!dev.busy) setDeleting(null); }}><p>{deleting.name}</p><Actions><DangerButton disabled={dev.busy} onClick={() => void run(async () => { await dev.request(`/connections/${deleting.id}`, undefined, 'DELETE', true); setDeleting(null); }, 'Verbindung gelöscht.')}>{t('Löschen')}</DangerButton><SecondaryButton disabled={dev.busy} onClick={() => setDeleting(null)}>{t('Abbrechen')}</SecondaryButton></Actions></Dialog>}
    </Card>;
}
