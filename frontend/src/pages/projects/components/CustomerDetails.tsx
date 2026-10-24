import styled from 'styled-components';
import type { Customer, CustomerContact, Project } from '../types/project.types';
import { useTranslation } from '../../../hooks/languageContext';
import { DangerButton, FormActions, FormCard, PrimaryButton, SecondaryButton } from '../styles/projectStyles';

const Layout = styled.div`
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start;
    > section { min-width: 0; margin: 0; } h2 { margin: 0; font-size: 17px; } .heading { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    dl { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; font-size: 13px; line-height: 1.6; }
    dt, .muted { color: ${({ theme }) => theme.colors.textSecondary}; } dd { margin: 0; overflow-wrap: anywhere; }
    .wide { grid-column: 1 / -1; } .notes { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-size: 14px; }
    .contact { padding: 18px 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; }
    h3 { font-size: 15px; margin: 0 0 6px; } .contact p { margin: 4px 0; font-size: 13px; overflow-wrap: anywhere; }
    .project { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 16px 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; }
    @media (max-width: 850px) { grid-template-columns: minmax(0, 1fr); }
`;
type Props = { customer: Customer; projects: Project[]; onBack: () => void; onEdit: () => void; onOpenProject: (id: number) => void;
    onAddContact: () => void; onEditContact: (contact: CustomerContact) => void; onRemoveContact: (contact: CustomerContact) => void; onEditNotes: () => void };
export default function CustomerDetails({ customer, projects, onBack, onEdit, onOpenProject, onAddContact, onEditContact, onRemoveContact, onEditNotes }: Props) {
    const { t } = useTranslation(); const contacts = customer.contacts ?? []; const ownProjects = projects.filter(project => project.customerId === customer.id);
    const value = (text: string | undefined) => text || t('Nicht hinterlegt');
    return <section aria-label={t('Kundendetails')}>
        <FormActions style={{ margin: '0 0 24px', justifyContent: 'space-between' }}>
            <SecondaryButton onClick={onBack}>{t('← Zurück zu den Kunden')}</SecondaryButton><SecondaryButton onClick={onEdit}>{t('Stammdaten bearbeiten')}</SecondaryButton>
        </FormActions>
        <Layout>
            <FormCard as="section"><div className="heading"><h2>{t('Stammdaten')}</h2><span className="muted">#{customer.id}</span></div>
                <dl><dt>{t('Kundenname')}</dt><dd>{customer.name}</dd><dt>{t('Branche')}</dt><dd>{value(customer.industry)}</dd>
                    <dt>{t('Anschrift')}</dt><dd>{value(customer.street)}<br />{[customer.postalCode, customer.city].filter(Boolean).join(' ') || t('Nicht hinterlegt')}<br />{customer.country}</dd>
                    <dt>{t('E-Mail')}</dt><dd>{value(customer.email)}</dd><dt>{t('Telefonnummer')}</dt><dd>{value(customer.phone)}</dd><dt>{t('Internetadresse')}</dt><dd>{value(customer.website)}</dd></dl>
            </FormCard>
            <FormCard as="section"><div className="heading"><h2>{t('Ansprechpartner')} ({contacts.length})</h2><PrimaryButton onClick={onAddContact} disabled={contacts.length >= 100}>{t('+ Ansprechpartner')}</PrimaryButton></div>
                {!contacts.length && <p className="muted">{t('Noch keine Ansprechpartner hinterlegt.')}</p>}
                {contacts.map(contact => <article className="contact" key={contact.id}><h3>{contact.name}</h3><p className="muted">{value(contact.role)}</p>
                    <p>{t('E-Mail')}: {value(contact.email)}</p><p>{t('Telefonnummer')}: {value(contact.phone)}</p>
                    <FormActions><SecondaryButton onClick={() => onEditContact(contact)}>{t('Bearbeiten')}</SecondaryButton><DangerButton onClick={() => onRemoveContact(contact)}>{t('Entfernen')}</DangerButton></FormActions>
                </article>)}
            </FormCard>
            <FormCard as="section"><div className="heading"><h2>{t('Zugeordnete Projekte')} ({ownProjects.length})</h2></div>
                {!ownProjects.length && <p className="muted">{t('Keine Projekte zugeordnet.')}</p>}
                {ownProjects.map(project => <article className="project" key={project.id}><div><h3>{project.name}</h3><small className="muted">{t('Deadline')}: {project.deadline}</small></div><SecondaryButton onClick={() => onOpenProject(project.id)}>{t('Öffnen')}</SecondaryButton></article>)}
            </FormCard>
            <FormCard as="section"><div className="heading"><h2>{t('Interne Notizen')}</h2><SecondaryButton onClick={onEditNotes}>{t('Notizen bearbeiten')}</SecondaryButton></div>
                {customer.notes ? <p className="notes">{customer.notes}</p> : <p className="muted">{t('Noch keine internen Notizen hinterlegt.')}</p>}
            </FormCard>
        </Layout>
    </section>;
}
