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
    return (
        <FormCard as="form" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <FormHeader>
                <h2>{isEditing ? 'Projekt bearbeiten' : 'Neues Projekt'}</h2>
                <CloseButton type="button" aria-label="Projektformular schließen" onClick={onClose}>×</CloseButton>
            </FormHeader>
            <FormGrid>
                <Field>
                    Projektname <Required>*</Required>
                    <Input required autoFocus value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="z. B. Website Relaunch" />
                </Field>
                <Field>
                    Kunde <Required>*</Required>
                    <Select required value={draft.customerId || ''} onChange={(event) => {
                        const customerId = Number(event.target.value);
                        if (customerId === -1) onNewCustomer();
                        else onChange({ ...draft, customerId });
                    }}>
                        <option value="" disabled>Bitte Kunden auswählen</option>
                        {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        <option value={-1}>+ Neuen Kunden anlegen …</option>
                    </Select>
                </Field>
                <Field>
                    Deadline <Required>*</Required>
                    <Input type="date" required value={draft.deadline} onChange={(event) => onChange({ ...draft, deadline: event.target.value })} />
                </Field>
            </FormGrid>
            <CheckboxRow>
                <input type="checkbox" checked={draft.planningCompleted} onChange={(event) => onChange({ ...draft, planningCompleted: event.target.checked })} />
                Planung abgeschlossen
            </CheckboxRow>
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <FormActions>
                <SecondaryButton type="button" onClick={onClose}>Abbrechen</SecondaryButton>
                <PrimaryButton type="submit">Speichern</PrimaryButton>
            </FormActions>
        </FormCard>
    );
}
