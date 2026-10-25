import { useState } from 'react';
import { useTranslation } from '../../hooks/languageContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { apiEnabled } from '../../services/api/runtime';
import { downloadBusiness } from '../../services/business/download';
import { Panel } from '../business/businessStyles';
import { Field, Input, Select, PrimaryButton, CheckboxRow } from '../../components/ui/formStyles';
import { todayDate } from './timeLogic';
export default function MonthlyTimesheet() {
    const { t, language } = useTranslation(), workspace = useWorkspacePersistence().getSnapshot().data!;
    const [month, setMonth] = useState(todayDate().slice(0, 7)), [customer, setCustomer] = useState(''), [project, setProject] = useState(''), [comments, setComments] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
    return <Panel><h2>{t('Monatlicher Leistungsnachweis')}</h2><form onSubmit={event => { event.preventDefault(); setBusy(true); setError(null); const parameters = new URLSearchParams({ month, language, comments: String(comments), ...(customer ? { customerId: customer } : {}), ...(project ? { projectId: project } : {}) });
        void downloadBusiness(`/me/business/timesheet/pdf?${parameters}`, `timesheet-${month}.pdf`).catch(value => setError(value instanceof Error ? value.message : 'Laden fehlgeschlagen')).finally(() => setBusy(false));
    }}><fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field>{t('Monat')}<Input type="month" required value={month} onChange={event => setMonth(event.target.value)} /></Field><Field>{t('Kunde')}<Select value={customer} onChange={event => { setCustomer(event.target.value); setProject(''); }}><option value="">{t('Alle Kunden')}</option>{workspace.customers.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
        <Field>{t('Projekt')}<Select value={project} onChange={event => setProject(event.target.value)}><option value="">{t('Alle Projekte')}</option>{workspace.projects.filter(value => !customer || value.customerId === Number(customer)).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field><CheckboxRow><input type="checkbox" checked={comments} onChange={event => setComments(event.target.checked)} />{t('Kommentare einschließen')}</CheckboxRow>
        <PrimaryButton disabled={!apiEnabled || busy}>{t('PDF herunterladen')}</PrimaryButton></fieldset>{error && <p role="alert">{t(error)}</p>}</form></Panel>;
}
