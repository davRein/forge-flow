import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { Customer, Project } from '../types/project.types';
import { DangerButton, FormActions, FormCard, PrimaryButton } from '../styles/projectStyles';

type Props = {
    project: Project;
    customer?: Customer;
    onEdit: () => void;
    onDelete: () => void;
};

export default function SettingsTab({ project, customer, onEdit, onDelete }: Props) {
    const { t: tx } = useUiTranslation();

    return (
        <FormCard>
            <h3>{tx('Projekteinstellungen')}</h3>
            <p>{tx('Kunde: ')}{customer?.name ?? tx('Nicht zugeordnet')}</p>
            <p>{tx('Deadline: ')}{project.deadline}</p>
            <p>{tx('Planung: ')}{project.planningCompleted ? tx('Abgeschlossen') : tx('Noch offen')}</p>
            <FormActions>
                <PrimaryButton onClick={onEdit}>{tx('Projekt bearbeiten')}</PrimaryButton>
                <DangerButton onClick={onDelete}>{tx('Projekt löschen')}</DangerButton>
            </FormActions>
        </FormCard>
    );
}
