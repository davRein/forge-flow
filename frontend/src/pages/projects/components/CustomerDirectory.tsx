import { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../../hooks/languageContext';
import { Customer, Project } from '../types/project.types';
import { DangerButton, Field, FormActions, FormCard, Input, SecondaryButton } from '../styles/projectStyles';
import { FilterRow, ResultCount } from '../styles/pageStyles';

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
    margin-top: 20px;
`;
const Card = styled(FormCard)`
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    h2 { margin-top: 0; }
    dl { display: grid; grid-template-columns: 100px 1fr; gap: 10px; }
    dt { color: ${({ theme }) => theme.colors.textSecondary}; }
    dd { margin: 0; }
`;
const ProjectLink = styled(SecondaryButton)`
    display: block;
    width: 100%;
    margin-top: 8px;
    text-align: left;
`;

type Props = {
    customers: Customer[];
    projects: Project[];
    onEdit: (customer: Customer) => void;
    onDelete: (customer: Customer) => void;
    onOpenProject: (projectId: number) => void;
    onOpenCustomer: (customerId: number) => void;
};

export default function CustomerDirectory({ customers, projects, onEdit, onDelete, onOpenProject, onOpenCustomer }: Props) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const search = query.trim().toLocaleLowerCase('de');
    const filtered = customers.filter((customer) => [customer.name, customer.email, customer.postalCode ?? '', customer.city, customer.industry].some((value) => value.toLocaleLowerCase('de').includes(search)));
    return (
        <>
            <FilterRow><Field>
                Kunden suchen
                <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, E-Mail, Ort oder Branche" />
            </Field>
            <ResultCount aria-live="polite">{filtered.length} von {customers.length} Kunden</ResultCount></FilterRow>
            {filtered.length === 0 && <FormCard>{customers.length === 0 ? 'Noch keine Kunden vorhanden. Lege den ersten Kunden an.' : 'Keine Kunden für diese Suche gefunden.'}</FormCard>}
            <Grid>
                {filtered.map((customer) => {
                    const customerProjects = projects.filter((project) => project.customerId === customer.id);
                    return (
                        <Card as="article" key={customer.id}>
                            <h2><SecondaryButton onClick={() => onOpenCustomer(customer.id)} style={{ padding: 0, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left' }}>{customer.name}</SecondaryButton></h2>
                            <dl>
                                <dt>Adresse</dt><dd>{[customer.street, [customer.postalCode, customer.city].filter(Boolean).join(' '), customer.country].filter(Boolean).join(', ') || 'Nicht hinterlegt'}</dd>
                                <dt>E-Mail</dt><dd>{customer.email || 'Nicht hinterlegt'}</dd>
                                <dt>Telefon</dt><dd>{customer.phone || 'Nicht hinterlegt'}</dd>
                                <dt>Website</dt><dd>{customer.website || 'Nicht hinterlegt'}</dd>
                                <dt>Branche</dt><dd>{customer.industry || 'Nicht hinterlegt'}</dd>
                            </dl>
                            <h3>Projekte ({customerProjects.length})</h3>
                            {customerProjects.length === 0 && <p>Keine Projekte zugeordnet.</p>}
                            {customerProjects.map((project) => <ProjectLink key={project.id} onClick={() => onOpenProject(project.id)}>{project.name} öffnen</ProjectLink>)}
                            <FormActions>
                                <SecondaryButton onClick={() => onOpenCustomer(customer.id)}>{t('Details öffnen')}</SecondaryButton>
                                <SecondaryButton onClick={() => onEdit(customer)}>Bearbeiten</SecondaryButton>
                                <DangerButton disabled={customerProjects.length > 0} onClick={() => onDelete(customer)}>Löschen</DangerButton>
                            </FormActions>
                            {customerProjects.length > 0 && <p>Zum Löschen zuerst die Projekte einem anderen Kunden zuordnen oder löschen.</p>}
                        </Card>
                    );
                })}
            </Grid>
        </>
    );
}
