import { useContext, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import type { CustomerDraft } from '../types/project.types';
import Dialog from './Dialog';
import { GlobalSettingsContext } from '../../../hooks/globalSettingsContext';
import { useTranslation } from '../../../hooks/languageContext';
import { ErrorText, Field, FormActions, Input, PrimaryButton, Required, SecondaryButton, Select } from '../styles/projectStyles';

const Intro = styled.p`
    margin: -4px 0 24px; color: ${({ theme }) => theme.colors.textSecondary}; font-size: 13px; line-height: 1.6;
`;
const Section = styled.fieldset`
    border: 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; padding: 20px 0 0; margin: 0 0 24px; min-width: 0;
    legend { padding: 0 12px 0 0; font-size: 13px; font-weight: 650; color: ${({ theme }) => theme.colors.text}; }
`;
const Grid = styled.div`
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 16px;
    .full { grid-column: 1 / -1; } .address { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr); gap: 16px; }
    input, select { min-height: 42px; }
    @media (max-width: 540px) { grid-template-columns: minmax(0, 1fr); .address { grid-template-columns: minmax(0, 1fr); } }
`;
const Hint = styled.p`
    margin: 9px 0 0; font-size: 12px; line-height: 1.6; color: ${({ theme }) => theme.colors.textSecondary};
`;
const Footer = styled(FormActions)`
    border-top: 1px solid ${({ theme }) => theme.colors.border}; padding-top: 18px; align-items: center;
    > small { margin-right: auto; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const unavailable = { data: null, status: 'loading' as const, error: null };
const noSubscribe = () => () => {};
const noSnapshot = () => unavailable;
type Props = { draft: CustomerDraft; isEditing: boolean; error: string; onChange: (draft: CustomerDraft) => void; onSave: () => void; onClose: () => void };

export default function CustomerModal({ draft, isEditing, error, onChange, onSave, onClose }: Props) {
    const { t } = useTranslation(); const catalog = useContext(GlobalSettingsContext);
    const state = useSyncExternalStore(catalog?.subscribe ?? noSubscribe, catalog?.getSnapshot ?? noSnapshot, noSnapshot);
    const industries = state.data?.industries ?? [];
    const legacy = isEditing && !!draft.industry && !industries.includes(draft.industry);
    const field = (key: keyof CustomerDraft, label: string, options: { type?: string; autoComplete?: string; placeholder?: string; required?: boolean; full?: boolean } = {}) =>
        <Field className={options.full ? 'full' : undefined}><span>{t(label)} {options.required !== false && <Required aria-hidden="true">*</Required>}</span>
            <Input name={key} type={options.type ?? 'text'} autoComplete={options.autoComplete} placeholder={options.placeholder} required={options.required !== false}
                autoFocus={key === 'name'} maxLength={key === 'postalCode' ? 32 : key === 'website' ? 2000 : 1000} value={draft[key] ?? ''}
                onChange={event => onChange({ ...draft, [key]: event.target.value })} /></Field>;
    return <Dialog title={t(isEditing ? 'Kunde bearbeiten' : 'Neuer Kunde')} onClose={onClose}>
        <Intro>{t('Stammdaten, Anschrift und Kontaktinformationen an einem Ort.')}</Intro>
        <form onSubmit={event => { event.preventDefault(); if (state.data && (industries.includes(draft.industry) || legacy)) onSave(); }}>
            <Section><legend>{t('Unternehmen')}</legend><Grid>
                {field('name', 'Kundenname', { autoComplete: 'organization', placeholder: t('z. B. Muster GmbH') })}
                <Field><span>{t('Branche')} <Required aria-hidden="true">*</Required></span>
                    <Select name="industry" required value={draft.industry} disabled={!state.data || state.status === 'loading'} onChange={event => onChange({ ...draft, industry: event.target.value })}>
                        <option value="">{t(state.status === 'loading' ? 'Branchen werden geladen …' : 'Branche auswählen')}</option>
                        {legacy && <option value={draft.industry}>{draft.industry} · {t('Bisheriger Wert')}</option>}
                        {industries.map(value => <option key={value} value={value}>{value}</option>)}
                    </Select></Field>
            </Grid><Hint>{t('Die Branchenliste wird zentral unter Einstellungen → Globale Einstellungen verwaltet.')}</Hint>
                {state.error && <><ErrorText role="alert">{t(state.error)}</ErrorText><SecondaryButton type="button" onClick={() => void catalog?.load()}>{t('Erneut laden')}</SecondaryButton></>}
                {legacy && <Hint>{t('Diese gespeicherte Branche ist nicht mehr in der Auswahlliste und bleibt erhalten.')}</Hint>}
            </Section>
            <Section><legend>{t('Anschrift')}</legend><Grid>
                {field('street', 'Straße und Hausnummer', { autoComplete: 'street-address', full: true })}
                <div className="full address">{field('postalCode', 'PLZ', { autoComplete: 'postal-code', placeholder: '10115' })}{field('city', 'Ort', { autoComplete: 'address-level2' })}</div>
                {field('country', 'Land', { autoComplete: 'country-name', full: true })}
            </Grid></Section>
            <Section><legend>{t('Kontakt')}</legend><Grid>
                {field('email', 'E-Mail', { type: 'email', autoComplete: 'email' })}
                {field('phone', 'Telefonnummer', { type: 'tel', autoComplete: 'tel' })}
                {field('website', 'Internetadresse', { autoComplete: 'url', placeholder: 'https://example.com', required: false, full: true })}
            </Grid></Section>
            {error && <ErrorText role="alert">{t(error)}</ErrorText>}
            <Footer><small>{t('* Pflichtfelder')}</small><SecondaryButton type="button" onClick={onClose}>{t('Abbrechen')}</SecondaryButton>
                <PrimaryButton type="submit" disabled={!state.data || state.status === 'loading'}>{t(isEditing ? 'Änderungen speichern' : 'Kunde anlegen')}</PrimaryButton></Footer>
        </form>
    </Dialog>;
}
