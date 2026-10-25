import { useEffect, useState } from 'react';
import { useBusiness } from '../../hooks/businessContext';
import { useTimeTracking } from '../../hooks/timeTrackingContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useTranslation } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import { apiEnabled } from '../../services/api/runtime';
import { downloadBusiness } from '../../services/business/download';
import type { BusinessDocument } from '../../services/business/business';
import { documentTotals } from '../../services/business/business';
import { PrimaryButton, SecondaryButton, Field, Select, FormActions } from '../../components/ui/formStyles';
import Dialog from '../../components/ui/Dialog';
import { Page, TableFrame } from './businessStyles';
import BusinessDocumentEditor from './BusinessDocumentEditor';
import BusinessProfileForm from './BusinessProfileForm';
import ProjectBudgets from './ProjectBudgets';
import ProjectTemplates from './ProjectTemplates';
import PortalManager from './PortalManager';
import { documentStatusLabel, newDocument } from './businessLogic';

export default function BusinessPage({ active = true, section = 'budgets' }: { active?: boolean; section?: string }) {
    const { data, store, status, error, conflict } = useBusiness(active); const times = useTimeTracking(); const workspace = useWorkspacePersistence(); const current = workspace.getSnapshot().data!;
    const { t, language, locale } = useTranslation(); const guard = useNavigationGuard();
    const [editor, setEditor] = useState<BusinessDocument | null>(null), [baseline, setBaseline] = useState(''), [confirm, setConfirm] = useState<'issue' | 'delete' | BusinessDocument['status'] | null>(null), [filter, setFilter] = useState(''), [notice, setNotice] = useState<string | null>(null);
    const discard = () => { setEditor(null); setConfirm(null); };
    useUnsavedChanges(!!editor && JSON.stringify(editor) !== baseline, discard, status === 'saving');
    useEffect(() => { if (active && section === 'documents' && times.status === 'idle') void times.store.load(); }, [active, section, times.status, times.store]);
    async function save(value: BusinessDocument, close = true) {
        if (!data || status !== 'ready' || conflict) return;
        const success = await store.save({ ...data, documents: [...data.documents.filter(document => document.id !== value.id), value] });
        if (success) { if (close) discard(); setNotice('Änderungen gespeichert.'); }
    }
    const pdf = (id: string) => { void downloadBusiness(`/me/business/documents/${id}/pdf?language=${language}`, `${id}.pdf`).catch(value => setNotice(value instanceof Error ? value.message : 'PDF konnte nicht geladen werden.')); };
    const open = (value: BusinessDocument) => { setEditor(structuredClone(value)); setBaseline(JSON.stringify(value)); setNotice(null); };
    return <Page lang={language}><h1>{t('Business')}</h1><p className="muted">{t('Budgets, Leistungen und Kundenfreigaben an einem Ort.')}</p>
        {error && <div role="alert"><p>{t(error)}</p><SecondaryButton disabled={status === 'saving'} onClick={() => guard.request(() => { discard(); void store.load(); })}>{t('Serverstand laden')}</SecondaryButton></div>}
        {notice && <p role="status">{t(notice)}</p>}{!data && <p role="status">{t('Daten werden geladen …')}</p>}
        {data && <>
            {section === 'budgets' && <ProjectBudgets />}{section === 'profile' && <BusinessProfileForm />}{section === 'templates' && <ProjectTemplates />}{section === 'portal' && <PortalManager />}
            {section === 'documents' && <><div className="toolbar"><Field>{t('Dokumenttyp')}<Select value={filter} onChange={event => setFilter(event.target.value)}><option value="">{t('Alle Dokumente')}</option><option value="offer">{t('Angebote')}</option><option value="invoice">{t('Rechnungen')}</option></Select></Field><div className="actions">{(['offer', 'invoice'] as const).map(kind => <PrimaryButton key={kind} disabled={!current.customers.length || status !== 'ready'} onClick={() => { const value = newDocument(kind, data.profile, current.customers[0].id); value.title = t(kind === 'offer' ? 'Angebot' : 'Rechnung'); open(value); }}>{t(kind === 'offer' ? '+ Angebot' : '+ Rechnung')}</PrimaryButton>)}</div></div>
                <TableFrame><table><thead><tr>{['Nummer', 'Titel', 'Kunde', 'Status', 'Gesamt', 'Aktionen'].map(value => <th key={value}>{t(value)}</th>)}</tr></thead><tbody>{data.documents.filter(value => !filter || value.kind === filter).map(value => <tr key={value.id}><td>{value.number || t('Entwurf')}</td><td><SecondaryButton onClick={() => open(value)}>{value.title}</SecondaryButton></td><td>{current.customers.find(customer => customer.id === value.customerId)?.name ?? value.recipient.split('\n')[0]}</td><td>{t(documentStatusLabel(value.status))}</td><td className="number">{new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(documentTotals(value).total / 100)}</td><td><SecondaryButton disabled={!apiEnabled} onClick={() => pdf(value.id)}>{t('PDF')}</SecondaryButton>{value.kind === 'offer' && value.status !== 'draft' && <SecondaryButton onClick={() => open({ ...value, id: crypto.randomUUID(), kind: 'invoice', title: t('Rechnung'), status: 'draft', number: '' })}>{t('In Rechnung übernehmen')}</SecondaryButton>}</td></tr>)}</tbody></table></TableFrame>
                {!data.documents.length && <p>{t('Noch keine Angebote oder Rechnungen vorhanden.')}</p>}
            </>}
            {editor && <BusinessDocumentEditor document={editor} business={data} workspace={current} times={times.data?.entries ?? []} busy={status !== 'ready' || conflict} error={error} onChange={setEditor} onSave={() => void save(editor)} onClose={() => { if (status !== 'saving') guard.request(discard); }}
                onIssue={() => setConfirm('issue')} onDelete={() => setConfirm('delete')} onPdf={() => pdf(editor.id)} onStatus={setConfirm} />}
            {editor && confirm && <Dialog title={t(confirm === 'issue' ? 'Dokument verbindlich freigeben?' : confirm === 'delete' ? 'Entwurf löschen?' : 'Status ändern?')} width={480} onClose={() => { if (status !== 'saving') setConfirm(null); }}><p>{t(confirm === 'issue' ? 'Nach der Freigabe werden Nummer und Inhalte festgeschrieben. Bitte Positionen, Adressen und Steuer prüfen.' : 'Bitte die Änderung bestätigen.')}</p>
                {error && <p role="alert">{t(error)}</p>}<FormActions><SecondaryButton disabled={status === 'saving'} onClick={() => setConfirm(null)}>{t('Abbrechen')}</SecondaryButton><PrimaryButton disabled={status !== 'ready' || conflict} onClick={() => {
                    if (confirm === 'delete') void store.save({ ...data, documents: data.documents.filter(value => value.id !== editor.id) }).then(success => { if (success) discard(); });
                    else void save({ ...editor, status: confirm === 'issue' ? 'issued' : confirm });
                }}>{t('Bestätigen')}</PrimaryButton></FormActions></Dialog>}
        </>}
    </Page>;
}
