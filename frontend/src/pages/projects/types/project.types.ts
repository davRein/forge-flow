export type Project = {
    id: number;
    customerId: number;
    name: string;
    planningCompleted: boolean;
    deadline: string;
};

export type Customer = {
    id: number;
    name: string;
    street: string;
    postalCode?: string;
    city: string;
    country: string;
    email: string;
    website?: string;
    phone: string;
    industry: string;
    contacts?: CustomerContact[];
    notes?: string;
};

export type CustomerContact = { id: number; customerId: number; name: string; role: string; email: string; phone: string };
export type ContactDraft = Pick<CustomerContact, 'name' | 'role' | 'email' | 'phone'>;

export type ProjectStatus = {
    label: string;
    color: string;
    pulse: boolean;
};

export type ProjectDraft = Omit<Project, 'id'>;
export type CustomerDraft = Omit<Customer, 'id' | 'contacts' | 'notes'>;
