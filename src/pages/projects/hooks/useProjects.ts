import { useState } from 'react';

import { projects } from '../../../data/projects';
import { customers } from '../../../data/customers';

import { Customer, Project } from '../types/project.types';

const NEW_CUSTOMER_VALUE = -1;

export function useProjects() {
    const [projectList, setProjectList] =
        useState<Project[]>(projects);

    const [customerList, setCustomerList] =
        useState<Customer[]>(
            customers.map((customer) => ({
                id: customer.id,
                name: customer.name,
                street: '',
                city: '',
                country: '',
                email: '',
                website: '',
                phone: '',
                industry: ''
            }))
        );

    const [selectedProjectId, setSelectedProjectId] =
        useState(projects[0].id);

    const [showCreateForm, setShowCreateForm] =
        useState(false);

    const [showCustomerModal, setShowCustomerModal] =
        useState(false);

    const [newProjectName, setNewProjectName] =
        useState('');

    const [newCustomerId, setNewCustomerId] =
        useState(customerList[0].id);

    const [newDeadline, setNewDeadline] =
        useState('');

    const [newPlanningCompleted, setNewPlanningCompleted] =
        useState(false);

    const [newCustomerName, setNewCustomerName] =
        useState('');

    const [newCustomerStreet, setNewCustomerStreet] =
        useState('');

    const [newCustomerCity, setNewCustomerCity] =
        useState('');

    const [newCustomerCountry, setNewCustomerCountry] =
        useState('');

    const [newCustomerEmail, setNewCustomerEmail] =
        useState('');

    const [newCustomerWebsite, setNewCustomerWebsite] =
        useState('');

    const [newCustomerPhone, setNewCustomerPhone] =
        useState('');

    const [newCustomerIndustry, setNewCustomerIndustry] =
        useState('');

    const selectedProject = projectList.find(
        (project) => project.id === selectedProjectId
    );

    const customer = customerList.find(
        (customer) => customer.id === selectedProject?.customerId
    );


    function resetProjectForm() {
        setNewProjectName('');
        setNewCustomerId(customerList[0]?.id ?? 1);
        setNewDeadline('');
        setNewPlanningCompleted(false);
    }

    function resetCustomerForm() {
        setNewCustomerName('');
        setNewCustomerStreet('');
        setNewCustomerCity('');
        setNewCustomerCountry('');
        setNewCustomerEmail('');
        setNewCustomerWebsite('');
        setNewCustomerPhone('');
        setNewCustomerIndustry('');
    }

    function closeProjectForm() {
        resetProjectForm();
        setShowCreateForm(false);
    }

    function closeCustomerModal() {
        resetCustomerForm();
        setShowCustomerModal(false);
    }

    function handleCreateProject() {
        if (!newProjectName.trim() || !newDeadline) {
            return;
        }

        const nextId =
            projectList.length > 0
                ? Math.max(
                ...projectList.map(
                    (project) => project.id
                )
            ) + 1
                : 1;

        const newProject: Project = {
            id: nextId,
            customerId: Number(newCustomerId),
            name: newProjectName.trim(),
            planningCompleted: newPlanningCompleted,
            deadline: newDeadline
        };

        setProjectList((currentProjects) => [
            ...currentProjects,
            newProject
        ]);

        setSelectedProjectId(newProject.id);

        closeProjectForm();
    }

    function handleCustomerChange(value: number) {
        if (value === NEW_CUSTOMER_VALUE) {
            setShowCustomerModal(true);
            return;
        }

        setNewCustomerId(value);
    }

    function handleCreateCustomer() {
        if (
            !newCustomerName.trim() ||
            !newCustomerStreet.trim() ||
            !newCustomerCity.trim() ||
            !newCustomerCountry.trim() ||
            !newCustomerEmail.trim() ||
            !newCustomerPhone.trim() ||
            !newCustomerIndustry.trim()
        ) {
            return;
        }

        const nextId =
            customerList.length > 0
                ? Math.max(
                ...customerList.map(
                    (customer) => customer.id
                )
            ) + 1
                : 1;

        const newCustomer: Customer = {
            id: nextId,
            name: newCustomerName.trim(),
            street: newCustomerStreet.trim(),
            city: newCustomerCity.trim(),
            country: newCustomerCountry.trim(),
            email: newCustomerEmail.trim(),
            website: newCustomerWebsite.trim(),
            phone: newCustomerPhone.trim(),
            industry: newCustomerIndustry.trim()
        };

        setCustomerList((currentCustomers) => [
            ...currentCustomers,
            newCustomer
        ]);

        setNewCustomerId(newCustomer.id);

        closeCustomerModal();
    }

    return {
        projectList,
        customerList,
        selectedProject,
        selectedProjectId,
        setSelectedProjectId,
        customer,

        showCreateForm,
        setShowCreateForm,
        showCustomerModal,

        newProjectName,
        setNewProjectName,
        newCustomerId,
        newDeadline,
        setNewDeadline,
        newPlanningCompleted,
        setNewPlanningCompleted,

        newCustomerName,
        setNewCustomerName,
        newCustomerStreet,
        setNewCustomerStreet,
        newCustomerCity,
        setNewCustomerCity,
        newCustomerCountry,
        setNewCustomerCountry,
        newCustomerEmail,
        setNewCustomerEmail,
        newCustomerWebsite,
        setNewCustomerWebsite,
        newCustomerPhone,
        setNewCustomerPhone,
        newCustomerIndustry,
        setNewCustomerIndustry,

        handleCustomerChange,
        handleCreateProject,
        handleCreateCustomer,
        closeProjectForm,
        closeCustomerModal
    };
}