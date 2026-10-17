import { Customer } from '../types/project.types';

import {
    CheckboxRow,
    CloseButton,
    Field,
    FormActions,
    FormCard,
    FormGrid,
    FormHeader,
    Input,
    PrimaryButton,
    Required,
    SecondaryButton,
    Select
} from '../styles/projectStyles';

const NEW_CUSTOMER_VALUE = -1;

type Props = {
    customers: Customer[];

    projectName: string;
    setProjectName: (value: string) => void;

    customerId: number;
    onCustomerChange: (value: number) => void;

    deadline: string;
    setDeadline: (value: string) => void;

    planningCompleted: boolean;
    setPlanningCompleted: (value: boolean) => void;

    onSave: () => void;
    onClose: () => void;
};

export default function ProjectForm({
                                        customers,

                                        projectName,
                                        setProjectName,

                                        customerId,
                                        onCustomerChange,

                                        deadline,
                                        setDeadline,

                                        planningCompleted,
                                        setPlanningCompleted,

                                        onSave,
                                        onClose
                                    }: Props) {

    return (
        <FormCard>
            <FormHeader>
                <h2>Neues Projekt</h2>

                <CloseButton onClick={onClose}>
                    ×
                </CloseButton>
            </FormHeader>

            <FormGrid>
                <Field>
                    Projektname <Required>*</Required>

                    <Input
                        value={projectName}
                        onChange={(event) =>
                            setProjectName(event.target.value)
                        }
                        placeholder="z. B. Website Relaunch"
                    />
                </Field>

                <Field>
                    Kunde <Required>*</Required>

                    <Select
                        value={customerId}
                        onChange={(event) =>
                            onCustomerChange(
                                Number(event.target.value)
                            )
                        }
                    >
                        {customers.map((customer) => (
                            <option
                                key={customer.id}
                                value={customer.id}
                            >
                                {customer.name}
                            </option>
                        ))}

                        <option value={NEW_CUSTOMER_VALUE}>
                            + New Customer ...
                        </option>
                    </Select>
                </Field>

                <Field>
                    Deadline <Required>*</Required>

                    <Input
                        type="date"
                        value={deadline}
                        onChange={(event) =>
                            setDeadline(event.target.value)
                        }
                    />
                </Field>
            </FormGrid>

            <CheckboxRow>
                <input
                    type="checkbox"
                    checked={planningCompleted}
                    onChange={(event) =>
                        setPlanningCompleted(
                            event.target.checked
                        )
                    }
                />

                Planung abgeschlossen
            </CheckboxRow>

            <FormActions>
                <SecondaryButton
                    type="button"
                    onClick={onClose}
                >
                    Abbrechen
                </SecondaryButton>

                <PrimaryButton
                    type="button"
                    onClick={onSave}
                >
                    Speichern
                </PrimaryButton>
            </FormActions>
        </FormCard>
    );
}