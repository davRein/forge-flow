import { useEffect, useState } from 'react';
import { apiClient, apiEnabled } from '../../services/api/runtime';
import type { PortalAccount, PortalLink } from '../../services/business/business';
import { useBusiness } from '../../hooks/businessContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useTranslation } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import Dialog from '../../components/ui/Dialog';
import { Field, Input, Select, FormActions, PrimaryButton, SecondaryButton, CheckboxRow } from '../../components/ui/formStyles';
import { Panel, TableFrame } from './businessStyles';

export default function PortalManager() {
    const { t } = useTranslation(); const { data } = useBusiness(); const workspace = useWorkspacePersistence().getSnapshot().data!; const guard = useNavigationGuard();
    const [accounts, setAccounts] = useState<PortalAccount[]>([]), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
    const [create, setCreate] = useState(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [customer, setCustomer] = useState(workspace.customers[0]?.id ?? 0);
    const [draft, setDraft] = useState<PortalLink | null>(null), [baseline, setBaseline] = useState('');
    const [reportMonth, setReportMonth] = useState('');
    const discard = () => { setCreate(false); setPassword(''); setName(''); setEmail(''); setDraft(null); };
    useUnsavedChanges(create && !!(name || email || password) || !!draft && JSON.stringify(draft) !== baseline, discard, busy);
    useEffect(() => { if (!apiEnabled) return; const controller = new AbortController(); void apiClient.request<PortalAccount[]>('/me/business/portal-accounts', { signal: controller.signal }).then(setAccounts).catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Laden fehlgeschlagen'); }); return () => controller.abort(); }, []);
    const toggle = (field: 'projectIds' | 'articleIds' | 'fileIds', id: number, checked: boolean) => { if (draft) setDraft({ ...draft, [field]: checked ? [...draft[field], id] : draft[field].filter(value => value !== id), ...(field === 'projectIds' && !checked ? { fileIds: draft.fileIds.filter(file => workspace.files.find(value => value.id === file)?.projectId !== id) } : {}) }); };
    async function save() {
        if (busy) return; setBusy(true); setError(null);
        try {
            if (create) { const result = await apiClient.request<PortalAccount>('/me/business/portal-accounts', { method: 'POST', body: { name, email, password, customerId: customer } }); setAccounts([...accounts, result]); }
            else if (draft) { const value = await apiClient.request<PortalLink>(`/me/business/portal-accounts/${draft.userId}`, { method: 'PUT', headers: { 'If-Match': `"${draft.revision}"` }, body: draft }); setAccounts(accounts.map(account => account.link.userId === value.userId ? { ...account, link: value } : account)); }
            discard();
        } catch (value) { setError(value instanceof Error ? value.message : 'Speichern fehlgeschlagen'); } finally { setBusy(false); }
    }
    return <><div className="toolbar"><h2>{t('Kundenportal')}</h2><PrimaryButton disabled={!apiEnabled || !workspace.customers.length} onClick={() => setCreate(true)}>{t('+ Portal-Konto')}</PrimaryButton></div>
        <p className="muted">{t('Portal-Konten sehen ausschließlich ausdrücklich freigegebene Inhalte. Zugangsdaten werden nicht automatisch versendet.')}</p>
        <p className="muted">{t('Das Portal zeigt den veröffentlichten Stand. Erneutes Speichern der Freigaben veröffentlicht den aktuellen Stand.')}</p>
        {!apiEnabled && <p>{t('Portal-Konten benötigen den API-Modus.')}</p>}{error && <p role="alert">{t(error)}</p>}
        <TableFrame><table><thead><tr>{['Name', 'E-Mail', 'Kunde', 'Status', 'Aktionen'].map(value => <th key={value}>{t(value)}</th>)}</tr></thead><tbody>{accounts.map(account => <tr key={account.user.id}><td>{account.user.name}</td><td>{account.user.email}</td><td>{workspace.customers.find(value => value.id === account.link.customerId)?.name ?? `#${account.link.customerId}`}</td><td>{t(account.link.active ? 'Aktiv' : 'Widerrufen')}</td><td><SecondaryButton onClick={() => { setDraft(structuredClone(account.link)); setBaseline(JSON.stringify(account.link)); }}>{t('Freigaben bearbeiten')}</SecondaryButton></td></tr>)}</tbody></table></TableFrame>
        {(create || draft) && <Dialog title={t(create ? 'Portal-Konto anlegen' : 'Portal-Freigaben')} onClose={() => { if (!busy) guard.request(discard); }}><form onSubmit={event => { event.preventDefault(); void save(); }}>
            <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>{create ? <>
                <Field>{t('Name')}<Input required maxLength={1000} value={name} onChange={event => setName(event.target.value)} /></Field><Field>{t('E-Mail')}<Input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></Field>
                <Field>{t('Initiales Passwort')}<Input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></Field><Field>{t('Kunde')}<Select required value={customer || ''} onChange={event => setCustomer(Number(event.target.value))}><option value="">{t('Bitte auswählen')}</option>{workspace.customers.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
            </> : draft && <>
                <CheckboxRow><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} />{t('Zugang aktiv')}</CheckboxRow>
                <Panel><h3>{t('Projekte')}</h3>{workspace.projects.filter(value => value.customerId === draft.customerId).map(value => <CheckboxRow key={value.id}><input type="checkbox" checked={draft.projectIds.includes(value.id)} onChange={event => toggle('projectIds', value.id, event.target.checked)} />{value.name}</CheckboxRow>)}</Panel>
                <Panel><h3>{t('Dokumentationsseiten')}</h3>{workspace.wiki.articles.map(value => <CheckboxRow key={value.id}><input type="checkbox" checked={draft.articleIds.includes(value.id)} onChange={event => toggle('articleIds', value.id, event.target.checked)} />{value.title}</CheckboxRow>)}</Panel>
                <Panel><h3>{t('Dateien')}</h3>{workspace.files.filter(value => draft.projectIds.includes(value.projectId)).map(value => <CheckboxRow key={value.id}><input type="checkbox" checked={draft.fileIds.includes(value.id)} onChange={event => toggle('fileIds', value.id, event.target.checked)} />{value.name}</CheckboxRow>)}</Panel>
                <Panel><h3>{t('Angebote & Rechnungen')}</h3>{data!.documents.filter(value => value.customerId === draft.customerId && value.status !== 'draft').map(value => <CheckboxRow key={value.id}><input type="checkbox" checked={draft.documentIds.includes(value.id)} onChange={event => setDraft({ ...draft, documentIds: event.target.checked ? [...draft.documentIds, value.id] : draft.documentIds.filter(id => id !== value.id) })} />{value.number} · {value.title}</CheckboxRow>)}</Panel>
                <Panel><h3>{t('Leistungsnachweise')}</h3><p className="muted">{t('Freigegebene Monate enthalten nur diesen Kunden und freigegebene Projekte. Zeitkommentare bleiben privat.')}</p><Field>{t('Monat')}<Input type="month" value={reportMonth} onChange={event => setReportMonth(event.target.value)} /></Field><SecondaryButton type="button" disabled={!/^\d{4}-\d{2}$/.test(reportMonth)} onClick={() => setDraft({ ...draft, reportMonths: [...new Set([...draft.reportMonths, reportMonth])] })}>{t('Monat freigeben')}</SecondaryButton>{draft.reportMonths.map(month => <CheckboxRow key={month}><input type="checkbox" checked onChange={() => setDraft({ ...draft, reportMonths: draft.reportMonths.filter(value => value !== month) })} />{month}</CheckboxRow>)}</Panel>
            </>}</fieldset>{error && <p role="alert">{t(error)}</p>}<FormActions><SecondaryButton type="button" disabled={busy} onClick={() => guard.request(discard)}>{t('Abbrechen')}</SecondaryButton><PrimaryButton disabled={busy}>{t('Speichern')}</PrimaryButton></FormActions>
        </form></Dialog>}
    </>;
}
