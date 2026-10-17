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
    city: string;
    country: string;
    email: string;
    website?: string;
    phone: string;
    industry: string;
};

export type ProjectStatus = {
    label: string;
    color: string;
    pulse: boolean;
};