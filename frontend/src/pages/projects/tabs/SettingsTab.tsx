import { Customer, Project } from '../types/project.types';
import { DangerButton, FormActions, FormCard, PrimaryButton } from '../styles/projectStyles';

type Props = {
    project: Project;
    customer?: Customer;
    onEdit: () => void;
    onDelete: () => void;
};

export default function SettingsTab({ project, customer, onEdit, onDelete }: Props) {
    return (
        <FormCard>
            <h3>Projekteinstellungen</h3>
            <p>Kunde: {customer?.name ?? 'Nicht zugeordnet'}</p>
            <p>Deadline: {project.deadline}</p>
            <p>Planung: {project.planningCompleted ? 'Abgeschlossen' : 'Noch offen'}</p>
            <FormActions>
                <PrimaryButton onClick={onEdit}>Projekt bearbeiten</PrimaryButton>
                <DangerButton onClick={onDelete}>Projekt löschen</DangerButton>
            </FormActions>
        </FormCard>
    );
}
