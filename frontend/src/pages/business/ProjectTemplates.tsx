import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../hooks/businessContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useTranslation } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import { apiClient, apiEnabled } from '../../services/api/runtime';
import type { BusinessData, ProjectTemplate } from '../../services/business/business';
import { Field, Input, Select, FormGrid, FormActions, PrimaryButton, SecondaryButton } from '../../components/ui/formStyles';
import Dialog from '../../components/ui/Dialog';
import { Panel, Textarea } from './businessStyles';
import { todayDate } from '../timeTracker/timeLogic';
import { applyLocalTemplate } from './businessLogic';

export default function ProjectTemplates() {
    const { data, store, status, conflict, error } = useBusiness(); const workspace = useWorkspacePersistence(); const current = workspace.getSnapshot().data!; const { t } = useTranslation(); const guard = useNavigationGuard(); const navigate = useNavigate();
    const [draft, setDraft] = useState<ProjectTemplate | null>(null), [baseline, setBaseline] = useState(''), [source, setSource] = useState('');
    const [apply, setApply] = useState<ProjectTemplate | null>(null), [name, setName] = useState(''), [customer, setCustomer] = useState(current.customers[0]?.id ?? 0), [deadline, setDeadline] = useState(todayDate()), [busy, setBusy] = useState(false), [failure, setFailure] = useState<string | null>(null);
    const discard = () => { setDraft(null); setApply(null); };
    useUnsavedChanges(!!draft && JSON.stringify(draft) !== baseline || !!apply && !!name.trim(), discard, busy || status === 'saving');
    const newTemplate = () => { const value: ProjectTemplate = { id: crypto.randomUUID(), name: '', description: '', tasks: [], milestones: [], pages: [] }; setDraft(value); setBaseline(JSON.stringify(value)); };
    async function createProject() {
        if (!apply || busy || workspace.getSnapshot().status !== 'ready') return; setBusy(true); setFailure(null);
        try {
            let id: number;
            if (apiEnabled && store.persistence === 'account') {
                const value = await apiClient.request<{ business: BusinessData; projectId: number }>(`/me/business/templates/${apply.id}/apply`, { method: 'POST', body: { revision: data!.revision, workspaceRevision: workspace.getRevision(), name, customerId: customer, deadline } });
                store.accept(value.business); setApply(null); if (!await workspace.refreshExternal()) throw new Error('Projekt wurde angelegt. Bitte den Arbeitsbereich neu laden.'); id = value.projectId;
            } else {
                const value = applyLocalTemplate(current, apply, name, customer, deadline); id = value.projectId;
                workspace.update('projects', value.data.projects); workspace.update('tasks', value.data.tasks); workspace.update('epics', value.data.epics); workspace.update('wiki', value.data.wiki);
            }
            setApply(null); navigate(`/projectManager/projects?project=${id}`);
        } catch (value) { setFailure(value instanceof Error ? value.message : 'Speichern fehlgeschlagen'); } finally { setBusy(false); }
    }
    return <><div className="toolbar"><h2>{t('Projektvorlagen')}</h2><PrimaryButton onClick={newTemplate}>{t('+ Vorlage')}</PrimaryButton></div>
        {data!.templates.map(template => <Panel key={template.id}><div className="toolbar"><div><h3>{template.name}</h3><p className="muted">{template.description}</p><small>{template.tasks.length} {t('Aufgaben')} · {template.milestones.length} {t('Meilensteine')} · {template.pages.length} {t('Seiten')}</small></div><div className="actions"><SecondaryButton onClick={() => { setDraft(structuredClone(template)); setBaseline(JSON.stringify(template)); }}>{t('Bearbeiten')}</SecondaryButton><PrimaryButton disabled={!current.customers.length} onClick={() => { setApply(template); setName(''); }}>{t('Projekt daraus anlegen')}</PrimaryButton></div></div></Panel>)}
        {!data!.templates.length && <Panel>{t('Vorlagen bündeln Aufgaben, Meilensteine und Dokumentation.')}</Panel>}
        {!apply && failure && <p role="alert">{t(failure)}</p>}
        {draft && <Dialog title={t('Projektvorlage')} onClose={() => guard.request(discard)}><form onSubmit={event => { event.preventDefault(); void store.save({ ...data!, templates: [...data!.templates.filter(value => value.id !== draft.id), { ...draft, tasks: draft.tasks.filter(value => value.title.trim()), milestones: draft.milestones.filter(value => value.trim()) }] }).then(success => { if (success) setDraft(null); }); }}>
            <Field>{t('Name')}<Input required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field>{t('Beschreibung')}<Textarea maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
            <div className="actions" style={{ display: 'flex', gap: 8, margin: '14px 0' }}><Select aria-label={t('Ausgangsprojekt')} value={source} onChange={event => setSource(event.target.value)}><option value="">{t('Ausgangsprojekt')}</option>{current.projects.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select><SecondaryButton type="button" disabled={!source} onClick={() => setDraft({ ...draft, tasks: current.tasks.filter(value => value.projectId === Number(source)).map(value => ({ title: value.title, description: value.description ?? '', priority: value.priority })), milestones: current.epics.filter(value => value.projectId === Number(source)).map(value => value.title) })}>{t('Aufgaben und Meilensteine übernehmen')}</SecondaryButton></div>
            <Field>{t('Aufgaben (eine pro Zeile)')}<Textarea value={draft.tasks.map(value => value.title).join('\n')} onChange={event => setDraft({ ...draft, tasks: event.target.value.split('\n').map(title => draft.tasks.find(value => value.title === title) ?? { title, description: '', priority: 'medium' }) })} /></Field>
            <Field>{t('Meilensteine (einer pro Zeile)')}<Textarea value={draft.milestones.join('\n')} onChange={event => setDraft({ ...draft, milestones: event.target.value.split('\n') })} /></Field>
            <h3>{t('Dokumentationsseiten')}</h3>{draft.pages.map((page, index) => <Panel key={index}><Field>{t('Titel')}<Input required maxLength={1000} value={page.title} onChange={event => setDraft({ ...draft, pages: draft.pages.map((value, position) => position === index ? { ...value, title: event.target.value } : value) })} /></Field><Field>{t('Inhalt')}<Textarea maxLength={100000} value={page.content} onChange={event => setDraft({ ...draft, pages: draft.pages.map((value, position) => position === index ? { ...value, content: event.target.value } : value) })} /></Field><SecondaryButton type="button" onClick={() => setDraft({ ...draft, pages: draft.pages.filter((_, position) => position !== index) })}>{t('Entfernen')}</SecondaryButton></Panel>)}
            <SecondaryButton type="button" disabled={draft.pages.length >= 30} onClick={() => setDraft({ ...draft, pages: [...draft.pages, { title: '', content: '' }] })}>{t('+ Seite')}</SecondaryButton>
            {error && <p role="alert">{t(error)}</p>}<FormActions><SecondaryButton type="button" onClick={() => guard.request(discard)}>{t('Abbrechen')}</SecondaryButton><PrimaryButton disabled={status !== 'ready' || conflict}>{t('Speichern')}</PrimaryButton></FormActions>
        </form></Dialog>}
        {apply && <Dialog title={t('Projekt aus Vorlage')} onClose={() => { if (!busy) guard.request(discard); }}><form onSubmit={event => { event.preventDefault(); void createProject(); }}><FormGrid>
            <Field>{t('Projektname')}<Input required maxLength={1000} value={name} onChange={event => setName(event.target.value)} /></Field><Field>{t('Kunde')}<Select required value={customer || ''} onChange={event => setCustomer(Number(event.target.value))}><option value="">{t('Bitte auswählen')}</option>{current.customers.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field><Field>{t('Deadline')}<Input type="date" required value={deadline} onChange={event => setDeadline(event.target.value)} /></Field>
            </FormGrid>{failure && <p role="alert">{t(failure)}</p>}<FormActions><PrimaryButton disabled={busy || workspace.getSnapshot().status !== 'ready'}>{t('Projekt anlegen')}</PrimaryButton></FormActions></form></Dialog>}
    </>;
}
