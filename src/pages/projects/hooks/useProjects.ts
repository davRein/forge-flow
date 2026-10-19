import { useRef, useState } from 'react';
import { useWorkspaceField } from '../../../hooks/workspaceContext';
import { Customer, CustomerDraft, Project, ProjectDraft } from '../types/project.types';

export function useProjects() {
    const [projectList, setProjectList] = useWorkspaceField('projects');
    const [customerList, setCustomerList] = useWorkspaceField('customers');
    const nextProjectId = useRef(Math.max(0, ...projectList.map((project) => project.id)) + 1);
    const nextCustomerId = useRef(Math.max(0, ...customerList.map((customer) => customer.id)) + 1);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(projectList[0]?.id ?? null);
    const [projectEditor, setProjectEditor] = useState<{ id: number | null; draft: ProjectDraft } | null>(null);
    const [customerEditor, setCustomerEditor] = useState<{ id: number | null; draft: CustomerDraft; selectForProject: boolean } | null>(null);
    const [projectError, setProjectError] = useState('');
    const [customerError, setCustomerError] = useState('');

    const selectedProject = projectList.find((project) => project.id === selectedProjectId);
    const customer = customerList.find((entry) => entry.id === selectedProject?.customerId);

    function openProjectEditor(project?: Project) {
        setProjectError('');
        setProjectEditor({ id: project?.id ?? null, draft: project ? {
            name: project.name, customerId: project.customerId,
            deadline: project.deadline, planningCompleted: project.planningCompleted
        } : { name: '', customerId: customerList[0]?.id ?? 0, deadline: '', planningCompleted: false } });
    }

    function closeProjectEditor() {
        setProjectEditor(null);
        setProjectError('');
    }

    function changeProject(draft: ProjectDraft) {
        setProjectEditor((current) => current ? { ...current, draft } : null);
        setProjectError('');
    }

    function saveProject() {
        if (!projectEditor) return;
        const { draft, id } = projectEditor;
        if (!draft.name.trim() || !draft.deadline || !customerList.some((entry) => entry.id === draft.customerId)) {
            setProjectError('Bitte Projektname, einen vorhandenen Kunden und eine Deadline angeben.');
            return;
        }
        const project: Project = { ...draft, id: id ?? nextProjectId.current++, name: draft.name.trim() };
        setProjectList((current) => id === null ? [...current, project] : current.map((entry) => entry.id === id ? project : entry));
        setSelectedProjectId(project.id);
        closeProjectEditor();
        return true;
    }

    function deleteProject(id: number) {
        setProjectList((current) => current.filter((project) => project.id !== id));
        if (selectedProjectId === id) setSelectedProjectId(projectList.find((project) => project.id !== id)?.id ?? null);
        if (projectEditor?.id === id) closeProjectEditor();
    }

    function openCustomerEditor(customer?: Customer, selectForProject = false) {
        setCustomerError('');
        setCustomerEditor({ id: customer?.id ?? null, selectForProject, draft: customer ? {
            name: customer.name, street: customer.street, city: customer.city, country: customer.country,
            email: customer.email, website: customer.website ?? '', phone: customer.phone, industry: customer.industry
        } : { name: '', street: '', city: '', country: '', email: '', website: '', phone: '', industry: '' } });
    }

    function closeCustomerEditor() {
        setCustomerEditor(null);
        setCustomerError('');
    }

    function changeCustomer(draft: CustomerDraft) {
        setCustomerEditor((current) => current ? { ...current, draft } : null);
        setCustomerError('');
    }

    function saveCustomer() {
        if (!customerEditor) return;
        const { draft, id, selectForProject } = customerEditor;
        if ([draft.name, draft.street, draft.city, draft.country, draft.email, draft.phone, draft.industry].some((value) => !value.trim())) {
            setCustomerError('Bitte alle Pflichtfelder ausfüllen.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
            setCustomerError('Bitte eine gültige E-Mail-Adresse angeben.');
            return;
        }
        const customer: Customer = {
            id: id ?? nextCustomerId.current++, name: draft.name.trim(), street: draft.street.trim(),
            city: draft.city.trim(), country: draft.country.trim(), email: draft.email.trim(),
            website: draft.website?.trim() ?? '', phone: draft.phone.trim(), industry: draft.industry.trim()
        };
        setCustomerList((current) => id === null ? [...current, customer] : current.map((entry) => entry.id === id ? customer : entry));
        if (selectForProject) {
            setProjectEditor((current) => current ? { ...current, draft: { ...current.draft, customerId: customer.id } } : null);
        }
        closeCustomerEditor();
    }

    function deleteCustomer(id: number) {
        if (projectList.some((project) => project.customerId === id)) return;
        setCustomerList((current) => current.filter((entry) => entry.id !== id));
        if (customerEditor?.id === id) closeCustomerEditor();
        setProjectEditor((current) => current?.draft.customerId === id
            ? { ...current, draft: { ...current.draft, customerId: customerList.find((entry) => entry.id !== id)?.id ?? 0 } }
            : current);
    }

    return {
        projectList, customerList, selectedProject, selectedProjectId, setSelectedProjectId, customer,
        projectEditor, projectError, openProjectEditor, closeProjectEditor, changeProject, saveProject, deleteProject,
        customerEditor, customerError, openCustomerEditor, closeCustomerEditor, changeCustomer, saveCustomer, deleteCustomer
    };
}
