import styled from 'styled-components';
import type { TimeEntry } from '../../services/time/timeTracking';
import type { Customer, Project } from '../projects/types/project.types';
import { useTranslation } from '../../hooks/languageContext';
import Dialog from '../../components/ui/Dialog';
import { Field, Input, Select, FormGrid, FormActions, PrimaryButton, SecondaryButton, DangerButton, CheckboxRow } from '../../components/ui/formStyles';
import { control } from '../../styles/primitives';
import { clock, duration } from './timeLogic';

const Comment = styled.textarea`${control} resize: vertical; min-height: 90px;`;
type Props = { entry: TimeEntry; existing: boolean; customers: Customer[]; projects: Project[]; busy: boolean; blocked: boolean; error: string | null;
    onChange: (entry: TimeEntry) => void; onSave: () => void; onClose: () => void; onDelete: () => void };
export default function TimeEntryEditor({ entry, existing, customers, projects, busy, blocked, error, onChange, onSave, onClose, onDelete }: Props) {
    const { t } = useTranslation();
    const ownProjects = projects.filter(project => project.customerId === entry.customerId);
    const change = (patch: Partial<TimeEntry>) => onChange({ ...entry, ...patch });
    return <Dialog title={t(existing ? 'Zeiteintrag bearbeiten' : 'Zeit erfassen')} onClose={onClose} width={620}>
        <form aria-label={t('Zeiteintrag')} onSubmit={event => { event.preventDefault(); if (!busy && !blocked) onSave(); }}>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
                <FormGrid>
                    <Field>{t('Datum')}<Input type="date" required min="0001-01-01" max="9999-12-31" autoFocus value={entry.date} onChange={event => change({ date: event.target.value })} /></Field>
                    <Field>{t('Beginn')}<Input type="time" required value={Number.isFinite(entry.startMinute) ? clock(entry.startMinute) : ''} onChange={event => { const [hours, minutes] = event.target.value.split(':').map(Number); change({ startMinute: hours * 60 + minutes }); }} /></Field>
                    <Field>{t('Arbeitszeit (Minuten)')}<Input type="number" required min={1} max={1440} step={1} value={Number.isNaN(entry.minutes) ? '' : entry.minutes} onChange={event => change({ minutes: event.target.valueAsNumber })} /></Field>
                    <Field>{t('Pause (Minuten)')}<Input type="number" required min={0} max={1439} step={1} value={Number.isNaN(entry.breakMinutes) ? '' : entry.breakMinutes} onChange={event => change({ breakMinutes: event.target.valueAsNumber })} /></Field>
                    <Field>{t('Kunde')}<Select value={entry.customerId ?? ''} onChange={event => { const id = event.target.value ? Number(event.target.value) : null; change({ customerId: id, customerName: customers.find(customer => customer.id === id)?.name ?? '', projectId: null, projectName: '' }); }}>
                        <option value="">{t('Interne Tätigkeit')}</option>
                        {entry.customerId !== null && !customers.some(customer => customer.id === entry.customerId) && <option value={entry.customerId}>{entry.customerName} ({t('Archiviert')})</option>}
                        {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </Select></Field>
                    <Field>{t('Projekt')}<Select disabled={entry.customerId === null} value={entry.projectId ?? ''} onChange={event => { const id = event.target.value ? Number(event.target.value) : null; change({ projectId: id, projectName: ownProjects.find(project => project.id === id)?.name ?? '' }); }}>
                        <option value="">{t('Ohne Projekt')}</option>
                        {entry.projectId !== null && !ownProjects.some(project => project.id === entry.projectId) && <option value={entry.projectId}>{entry.projectName} ({t('Archiviert')})</option>}
                        {ownProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </Select></Field>
                </FormGrid>
                <p style={{ fontSize: 12, margin: '14px 0' }}>{t('Netto-Arbeitszeit; Pausen kommen zur Zeitspanne hinzu.')}
                    {' '}{Number.isFinite(entry.minutes + entry.breakMinutes + entry.startMinute) && <strong>{duration(entry.minutes)} · {clock(entry.startMinute)}–{clock(entry.startMinute + entry.minutes + entry.breakMinutes)}</strong>}</p>
                <Field>{t('Kommentar')}<Comment maxLength={2000} value={entry.comment} placeholder={t('Was hast du erledigt?')} onChange={event => change({ comment: event.target.value })} /></Field>
                <CheckboxRow style={{ marginTop: 14 }}><input type="checkbox" checked={entry.billable} onChange={event => change({ billable: event.target.checked })} />{t('Abrechenbar')}</CheckboxRow>
            </fieldset>
            {error && <p role="alert" style={{ marginTop: 14 }}>{t(error)}</p>}
            <FormActions>
                {existing && <DangerButton type="button" disabled={busy} onClick={onDelete} style={{ marginRight: 'auto' }}>{t('Löschen')}</DangerButton>}
                <SecondaryButton type="button" disabled={busy} onClick={onClose}>{t('Abbrechen')}</SecondaryButton>
                <PrimaryButton type="submit" disabled={busy || blocked}>{t(busy ? 'Wird gespeichert …' : 'Speichern')}</PrimaryButton>
            </FormActions>
        </form>
    </Dialog>;
}
