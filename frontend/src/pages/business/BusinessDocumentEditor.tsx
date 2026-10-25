import { useState } from 'react';
import type { BusinessData, BusinessDocument, BusinessLine } from '../../services/business/business';
import { documentTotals, lineTotals } from '../../services/business/business';
import type { Workspace } from '../../services/workspace/workspaceTypes';
import type { TimeEntry } from '../../services/time/timeTracking';
import { invoiceable } from './businessLogic';
import { useTranslation } from '../../hooks/languageContext';
import Dialog from '../../components/ui/Dialog';
import { Field, Input, Select, FormGrid, FormActions, SecondaryButton, PrimaryButton, DangerButton } from '../../components/ui/formStyles';
import { Textarea, TableFrame, Panel } from './businessStyles';

type Props = { document: BusinessDocument; business: BusinessData; workspace: Workspace; times: TimeEntry[]; busy: boolean; error: string | null;
    onChange: (document: BusinessDocument) => void; onSave: () => void; onIssue: () => void; onClose: () => void; onDelete: () => void; onPdf: () => void; onStatus: (status: BusinessDocument['status']) => void };
export default function BusinessDocumentEditor({ document, business, workspace, times, busy, error, onChange, onSave, onIssue, onClose, onDelete, onPdf, onStatus }: Props) {
    const { t, locale } = useTranslation(); const [month, setMonth] = useState(document.date.slice(0, 7)); const locked = document.status !== 'draft';
    const change = (value: Partial<BusinessDocument>) => onChange({ ...document, ...value });
    const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: document.currency }).format(cents / 100);
    const line = (index: number, patch: Partial<BusinessLine>) => change({ lines: document.lines.map((value, position) => position === index ? { ...value, ...patch } : value) });
    let total = { net: 0, tax: 0, total: 0 }; try { total = documentTotals(document); } catch { /* Incomplete form remains editable. */ }
    const importTimes = () => {
        const selected = invoiceable(times, business, document.customerId, document.projectId, month, document.id);
        change({ timeEntryIds: selected.map(value => value.id), lines: selected.map(value => ({ description: `${value.date} · ${value.projectName || t('Ohne Projekt')}${value.comment ? ': ' + value.comment : ''}`.slice(0, 1000), quantity: '1', minutes: value.minutes,
            unitPriceCents: business.budgets.find(budget => budget.projectId === value.projectId)?.hourlyRateCents ?? business.profile.hourlyRateCents, taxBasisPoints: business.profile.taxBasisPoints })) });
    };
    return <Dialog width={980} title={t(document.kind === 'invoice' ? 'Rechnung' : 'Angebot')} onClose={onClose}>
        <form aria-label={t('Geschäftsdokument')} onSubmit={event => { event.preventDefault(); onSave(); }}>
            <fieldset disabled={busy || locked} style={{ border: 0, padding: 0, margin: 0 }}><FormGrid>
                <Field>{t('Kunde')}<Select required value={document.customerId || ''} onChange={event => change({ customerId: Number(event.target.value), projectId: null, timeEntryIds: [], lines: [] })}><option value="">{t('Bitte auswählen')}</option>{workspace.customers.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
                <Field>{t('Projekt')}<Select value={document.projectId ?? ''} onChange={event => change({ projectId: event.target.value ? Number(event.target.value) : null })}><option value="">{t('Ohne Projekt')}</option>{workspace.projects.filter(value => value.customerId === document.customerId).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
                <Field>{t('Titel')}<Input required maxLength={300} value={document.title} onChange={event => change({ title: event.target.value })} /></Field>
                <Field>{t('Währung')}<Select value={document.currency} onChange={event => change({ currency: event.target.value })}>{['EUR', 'USD', 'CHF', 'GBP'].map(value => <option key={value}>{value}</option>)}</Select></Field>
                <Field>{t('Datum')}<Input type="date" required value={document.date} onChange={event => change({ date: event.target.value })} /></Field>
                <Field>{t(document.kind === 'invoice' ? 'Fällig am' : 'Gültig bis')}<Input type="date" required min={document.date} value={document.dueDate} onChange={event => change({ dueDate: event.target.value })} /></Field>
            </FormGrid>
            <h3 style={{ margin: '20px 0 10px' }}>{t('Positionen')}</h3>
            {document.kind === 'invoice' && <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}><Field>{t('Abrechnungsmonat')}<Input type="month" value={month} onChange={event => setMonth(event.target.value)} /></Field><SecondaryButton type="button" disabled={!document.customerId} onClick={importTimes}>{t('Positionen aus Zeiten erstellen')}</SecondaryButton><small>{t('Ersetzt die Positionen durch noch nicht abgerechnete Zeiten.')}</small></div>}
            {document.lines.map((value, index) => <Panel key={index} style={{ marginTop: 12, padding: 12 }}>
                <Field>{t('Leistung')}<Input required maxLength={1000} value={value.description} onChange={event => line(index, { description: event.target.value })} /></Field>
                <FormGrid style={{ marginTop: 10 }}>
                    <Field>{t(value.minutes > 0 ? 'Arbeitszeit (Minuten)' : 'Menge')}<Input type="number" required min={value.minutes > 0 ? 1 : .001} step={value.minutes > 0 ? 1 : .001} value={value.minutes || value.quantity} onChange={event => line(index, value.minutes > 0 ? { minutes: event.target.valueAsNumber } : { quantity: event.target.value })} /></Field>
                    <Field>{t('Einzelpreis / Stundensatz')}<Input type="number" required min={0} max={1000000} step="0.01" value={value.unitPriceCents / 100} onChange={event => line(index, { unitPriceCents: Math.round(event.target.valueAsNumber * 100) })} /></Field>
                    <Field>{t('Steuer (%)')}<Input type="number" required min={0} max={100} step="0.01" value={value.taxBasisPoints / 100} onChange={event => line(index, { taxBasisPoints: Math.round(event.target.valueAsNumber * 100) })} /></Field>
                </FormGrid><FormActions><SecondaryButton type="button" onClick={() => change({ lines: document.lines.filter((_, position) => index !== position), timeEntryIds: document.timeEntryIds.filter((_, position) => index !== position) })}>{t('Position entfernen')}</SecondaryButton></FormActions>
            </Panel>)}
            <SecondaryButton type="button" disabled={document.lines.length >= 100} onClick={() => change({ lines: [...document.lines, { description: '', quantity: '1', minutes: 0, unitPriceCents: business.profile.hourlyRateCents, taxBasisPoints: business.profile.taxBasisPoints }] })}>{t('+ Position')}</SecondaryButton>
            <Field style={{ marginTop: 16 }}>{t('Hinweise / Zahlungsbedingungen')}<Textarea maxLength={10000} value={document.notes} onChange={event => change({ notes: event.target.value })} /></Field></fieldset>
            <h3>{t('Vorschau')} · {document.number || t('Entwurf')}</h3>
            <FormGrid><Panel><h3>{t('Absender')}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{locked ? document.issuer : [business.profile.company, business.profile.address, business.profile.email, business.profile.taxId, business.profile.bank].filter(Boolean).join('\n')}</p></Panel><Panel><h3>{t('Empfänger')}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{locked ? document.recipient : (() => { const customer = workspace.customers.find(value => value.id === document.customerId); return customer ? [customer.name, customer.street, [customer.postalCode, customer.city].filter(Boolean).join(' '), customer.country].filter(Boolean).join('\n') : ''; })()}</p></Panel></FormGrid>
            <TableFrame><table><thead><tr><th>{t('Leistung')}</th><th>{t('Netto')}</th></tr></thead><tbody>{document.lines.map((value, index) => { let net = 0; try { net = lineTotals(value).net; } catch { /* Incomplete row. */ } return <tr key={index}><td>{value.description}</td><td className="number">{money(net)}</td></tr>; })}</tbody></table></TableFrame>
            <p>{t('Netto')}: {money(total.net)} · {t('Steuer')}: {money(total.tax)} · <strong>{t('Gesamt')}: {money(total.total)}</strong></p>
            {error && <p role="alert">{t(error)}</p>}
            <FormActions>
                {!locked && <DangerButton type="button" disabled={busy} onClick={onDelete} style={{ marginRight: 'auto' }}>{t('Entwurf löschen')}</DangerButton>}
                <SecondaryButton type="button" disabled={busy} onClick={onClose}>{t('Schließen')}</SecondaryButton>
                {locked ? <><SecondaryButton type="button" onClick={onPdf}>{t('PDF herunterladen')}</SecondaryButton>{document.status === 'issued' && (document.kind === 'invoice' ? <><PrimaryButton type="button" disabled={busy} onClick={() => onStatus('paid')}>{t('Als bezahlt markieren')}</PrimaryButton><DangerButton type="button" disabled={busy} onClick={() => onStatus('cancelled')}>{t('Stornieren')}</DangerButton></> : <><PrimaryButton type="button" disabled={busy} onClick={() => onStatus('accepted')}>{t('Angenommen')}</PrimaryButton><SecondaryButton type="button" disabled={busy} onClick={() => onStatus('rejected')}>{t('Abgelehnt')}</SecondaryButton></> )}</>
                    : <><SecondaryButton type="submit" disabled={busy}>{t('Entwurf speichern')}</SecondaryButton><PrimaryButton type="button" disabled={busy || !document.lines.length} onClick={onIssue}>{t('Prüfen und freigeben')}</PrimaryButton></>}
            </FormActions>
        </form>
    </Dialog>;
}
