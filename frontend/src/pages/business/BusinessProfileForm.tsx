import { useState } from 'react';
import { useBusiness } from '../../hooks/businessContext';
import { useTranslation } from '../../hooks/languageContext';
import { useUnsavedChanges } from '../../hooks/navigationGuard';
import { Field, Input, Select, FormGrid, FormActions, PrimaryButton } from '../../components/ui/formStyles';
import { Panel, Textarea } from './businessStyles';
export default function BusinessProfileForm() {
    const { data, store, status, conflict, error } = useBusiness(); const { t } = useTranslation();
    const [draft, setDraft] = useState(data!.profile), [baseline, setBaseline] = useState(JSON.stringify(data!.profile)), [saved, setSaved] = useState(false);
    useUnsavedChanges(JSON.stringify(draft) !== baseline, () => setDraft(data!.profile), status === 'saving');
    const change = (patch: Partial<typeof draft>) => { setDraft({ ...draft, ...patch }); setSaved(false); };
    return <Panel><h2>{t('Absender & Abrechnung')}</h2><form onSubmit={event => { event.preventDefault(); void store.save({ ...data!, profile: draft }).then(success => { if (success) { setBaseline(JSON.stringify(draft)); setSaved(true); } }); }}>
        <fieldset disabled={status !== 'ready' || conflict} style={{ border: 0, padding: 0 }}><FormGrid>
            <Field>{t('Unternehmen / Name')}<Input maxLength={1000} value={draft.company} onChange={event => change({ company: event.target.value })} /></Field>
            <Field>{t('E-Mail')}<Input type="email" maxLength={254} value={draft.email} onChange={event => change({ email: event.target.value })} /></Field>
            <Field>{t('Anschrift')}<Textarea maxLength={3000} value={draft.address} onChange={event => change({ address: event.target.value })} /></Field>
            <Field>{t('Bankverbindung / Zahlungsinformationen')}<Textarea maxLength={1000} value={draft.bank} onChange={event => change({ bank: event.target.value })} /></Field>
            <Field>{t('Steuernummer / USt-ID')}<Input maxLength={200} value={draft.taxId} onChange={event => change({ taxId: event.target.value })} /></Field>
            <Field>{t('Währung')}<Select value={draft.currency} onChange={event => change({ currency: event.target.value })}>{['EUR', 'USD', 'CHF', 'GBP'].map(value => <option key={value}>{value}</option>)}</Select></Field>
            <Field>{t('Standard-Stundensatz')}<Input type="number" min={0} max={1000000} step="0.01" required value={draft.hourlyRateCents / 100} onChange={event => change({ hourlyRateCents: Math.round(event.target.valueAsNumber * 100) })} /></Field>
            <Field>{t('Standard-Steuer (%)')}<Input type="number" min={0} max={100} step="0.01" required value={draft.taxBasisPoints / 100} onChange={event => change({ taxBasisPoints: Math.round(event.target.valueAsNumber * 100) })} /></Field>
            <Field>{t('Zahlungsziel (Tage)')}<Input type="number" min={0} max={365} step={1} required value={draft.paymentDays} onChange={event => change({ paymentDays: event.target.valueAsNumber })} /></Field>
        </FormGrid><FormActions><PrimaryButton>{t('Speichern')}</PrimaryButton></FormActions></fieldset>
        {error && <p role="alert">{t(error)}</p>}{saved && <p role="status" className="success">{t('Änderungen gespeichert.')}</p>}
    </form></Panel>;
}
