import styled from 'styled-components';
import Dialog from './Dialog';
import { useTranslation } from '../../../hooks/languageContext';
import type { useCustomerDetails } from '../hooks/useCustomerDetails';
import { ErrorText, Field, FormActions, FormGrid, Input, PrimaryButton, Required, SecondaryButton } from '../styles/projectStyles';
import { control } from '../../../styles/primitives';

const NotesInput = styled.textarea`${control} min-height: 220px; resize: vertical; line-height: 1.6;`;
export default function CustomerDetailDialogs({ state }: { state: ReturnType<typeof useCustomerDetails> }) {
    const { t } = useTranslation(); const contact = state.contactEditor, notes = state.notesEditor;
    return <>
        {contact && <Dialog title={t(contact.original ? 'Ansprechpartner bearbeiten' : 'Neuer Ansprechpartner')} onClose={state.closeContact}>
            <form onSubmit={event => { event.preventDefault(); state.saveContact(); }}>
                <FormGrid>
                    <Field><span>{t('Name')} <Required>*</Required></span><Input autoFocus required maxLength={1000} autoComplete="name" value={contact.draft.name} onChange={event => state.changeContact({ ...contact.draft, name: event.target.value })} /></Field>
                    <Field>{t('Funktion')}<Input maxLength={200} autoComplete="organization-title" value={contact.draft.role} onChange={event => state.changeContact({ ...contact.draft, role: event.target.value })} /></Field>
                    <Field>{t('E-Mail')}<Input type="email" maxLength={254} autoComplete="email" value={contact.draft.email} onChange={event => state.changeContact({ ...contact.draft, email: event.target.value })} /></Field>
                    <Field>{t('Telefonnummer')}<Input type="tel" maxLength={100} autoComplete="tel" value={contact.draft.phone} onChange={event => state.changeContact({ ...contact.draft, phone: event.target.value })} /></Field>
                </FormGrid>{state.error && <ErrorText role="alert">{t(state.error)}</ErrorText>}
                <FormActions><SecondaryButton type="button" onClick={state.closeContact}>{t('Abbrechen')}</SecondaryButton><PrimaryButton type="submit">{t('Speichern')}</PrimaryButton></FormActions>
            </form>
        </Dialog>}
        {notes && <Dialog title={t('Interne Notizen bearbeiten')} onClose={state.closeNotes}>
            <form onSubmit={event => { event.preventDefault(); state.saveNotes(); }}>
                <Field>{t('Notizen')}<NotesInput autoFocus maxLength={6000} value={notes.draft} onChange={event => state.changeNotes(event.target.value)} /></Field>
                <p>{notes.draft.length} / 6000</p>{state.error && <ErrorText role="alert">{t(state.error)}</ErrorText>}
                <FormActions><SecondaryButton type="button" onClick={state.closeNotes}>{t('Abbrechen')}</SecondaryButton><PrimaryButton type="submit">{t('Speichern')}</PrimaryButton></FormActions>
            </form>
        </Dialog>}
    </>;
}
