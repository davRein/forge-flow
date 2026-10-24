import { useState } from 'react';
import { useWorkspaceField } from '../../../hooks/workspaceContext';
import type { ContactDraft, CustomerContact } from '../types/project.types';

export function useCustomerDetails() {
    const [customers, setCustomers] = useWorkspaceField('customers');
    const [contactEditor, setContactEditor] = useState<{ customerId: number; original: CustomerContact | null; draft: ContactDraft } | null>(null);
    const [notesEditor, setNotesEditor] = useState<{ customerId: number; original: string; draft: string } | null>(null);
    const [error, setError] = useState('');
    function openContact(customerId: number, original: CustomerContact | null = null) {
        if (!customers.some(customer => customer.id === customerId)) return;
        setError(''); setContactEditor({ customerId, original, draft: original ? { name: original.name, role: original.role, email: original.email, phone: original.phone } : { name: '', role: '', email: '', phone: '' } });
    }
    function saveContact() {
        if (!contactEditor) return;
        const { customerId, original, draft } = contactEditor;
        const current = customers.find(customer => customer.id === customerId);
        const previous = current?.contacts?.find(contact => contact.id === original?.id);
        if (!current || original && (!previous || (['id', 'customerId', 'name', 'role', 'email', 'phone'] as const).some(key => previous[key] !== original[key]))) { setError('Die Kundendaten wurden inzwischen geändert. Bitte den Dialog neu öffnen.'); return; }
        const values = { name: draft.name.trim(), role: draft.role.trim(), email: draft.email.trim(), phone: draft.phone.trim() };
        if (!values.name || values.name.length > 1000 || values.role.length > 200 || values.phone.length > 100 || values.email.length > 254 || values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) { setError('Bitte Name und gültige Kontaktdaten angeben.'); return; }
        if (!original && (current.contacts?.length ?? 0) >= 100) { setError('Pro Kunde sind höchstens 100 Ansprechpartner möglich.'); return; }
        const id = original?.id ?? Math.max(0, ...customers.flatMap(customer => (customer.contacts ?? []).map(contact => contact.id))) + 1;
        if (!Number.isSafeInteger(id)) { setError('Keine weitere Kennung verfügbar.'); return; }
        const contact = { ...values, id, customerId };
        setCustomers(items => items.map(customer => customer.id === customerId ? { ...customer, contacts: original ? (customer.contacts ?? []).map(item => item.id === id ? contact : item) : [...(customer.contacts ?? []), contact] } : customer));
        setContactEditor(null); setError('');
    }
    function openNotes(customerId: number) {
        const customer = customers.find(entry => entry.id === customerId); if (!customer) return;
        const notes = customer.notes ?? ''; setError(''); setNotesEditor({ customerId, original: notes, draft: notes });
    }
    function saveNotes() {
        if (!notesEditor) return;
        const current = customers.find(customer => customer.id === notesEditor.customerId);
        if (!current || (current.notes ?? '') !== notesEditor.original) { setError('Die Kundendaten wurden inzwischen geändert. Bitte den Dialog neu öffnen.'); return; }
        if (notesEditor.draft.length > 6000) { setError('Notizen dürfen höchstens 6000 Zeichen enthalten.'); return; }
        setCustomers(items => items.map(customer => customer.id === notesEditor.customerId ? { ...customer, notes: notesEditor.draft } : customer));
        setNotesEditor(null); setError('');
    }
    function removeContact(customerId: number, contactId: number) {
        setCustomers(items => items.map(customer => customer.id === customerId ? { ...customer, contacts: (customer.contacts ?? []).filter(contact => contact.id !== contactId) } : customer));
    }
    return { contactEditor, notesEditor, error, openContact, saveContact, openNotes, saveNotes, removeContact,
        changeContact(draft: ContactDraft) { setContactEditor(current => current ? { ...current, draft } : null); setError(''); },
        changeNotes(draft: string) { setNotesEditor(current => current ? { ...current, draft } : null); setError(''); },
        closeContact() { setContactEditor(null); setError(''); }, closeNotes() { setNotesEditor(null); setError(''); }
    };
}
