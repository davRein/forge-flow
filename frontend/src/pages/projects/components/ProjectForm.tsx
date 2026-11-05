import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { Customer, ProjectDraft } from '../types/project.types';
import {
    CheckboxRow, CloseButton, ErrorText, Field, FormActions, FormCard,
    FormGrid, FormHeader, Input, PrimaryButton, Required, SecondaryButton, Select
} from '../styles/projectStyles';

type Props = {
    customers: Customer[];
    draft: ProjectDraft;
    isEditing: boolean;
    error: string;
    onChange: (draft: ProjectDraft) => void;
    onNewCustomer: () => void;
    onSave: () => void;
    onClose: () => void;
};

export default function ProjectForm({ customers, draft, isEditing, error, onChange, onNewCustomer, onSave, onClose }: Props) {
    const { t: tx } = useUiTranslation();

    return (
        <FormCard as="form" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <FormHeader>
                <h2>{isEditing ? tx('Projekt bearbeiten') : tx('Neues Projekt')}</h2>
                <CloseButton type="button" aria-label={tx('Projektformular schließen')} onClick={onClose}>×</CloseButton>
            </FormHeader>
            <FormGrid>
                <Field>
                    {tx('Projektname ')}<Required>*</Required>
                    <Input required autoFocus value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder={tx('z. B. Website Relaunch')} />
                </Field>
                <Field>
                    {tx('Kunde ')}<Required>*</Required>
                    <Select required value={draft.customerId || ''} onChange={(event) => {
                        const customerId = Number(event.target.value);
                        if (customerId === -1) onNewCustomer();
                        else onChange({ ...draft, customerId });
                    }}>
                        <option value="" disabled>{tx('Bitte Kunden auswählen')}</option>
                        {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        <option value={-1}>{tx('+ Neuen Kunden anlegen …')}</option>
                    </Select>
                </Field>
                <Field>
                    {tx('Deadline ')}<Required>*</Required>
                    <Input type="date" required value={draft.deadline} onChange={(event) => onChange({ ...draft, deadline: event.target.value })} />
                </Field>
            </FormGrid>
            <CheckboxRow>
                <input type="checkbox" checked={draft.planningCompleted} onChange={(event) => onChange({ ...draft, planningCompleted: event.target.checked })} />
                {tx('Planung abgeschlossen')}</CheckboxRow>
            {error && <ErrorText role="alert">{tx(error)}</ErrorText>}
            <FormActions>
                <SecondaryButton type="button" onClick={onClose}>{tx('Abbrechen')}</SecondaryButton>
                <PrimaryButton type="submit">{tx('Speichern')}</PrimaryButton>
            </FormActions>
        </FormCard>
    );
}
