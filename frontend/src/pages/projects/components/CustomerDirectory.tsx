import { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../../hooks/languageContext';
import type { Customer } from '../types/project.types';
import { Field, Input } from '../styles/projectStyles';
import { FilterRow, ResultCount } from '../styles/pageStyles';

const TableFrame = styled.div`
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.header};
`;
const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
    line-height: 1.5;
    th, td { padding: 12px 16px; text-align: left; overflow-wrap: anywhere; }
    thead { background: ${({ theme }) => theme.colors.content}; }
    thead th { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; font-weight: 600; }
    thead th:first-child { width: 44%; }
    tbody tr { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
    tbody tr[data-customer] { cursor: pointer; }
    tbody tr[data-customer]:hover, tbody tr:focus-within { background: ${({ theme }) => theme.colors.surfaceHover}; }
    tbody th { font-weight: 500; }
    .empty { padding: 24px 16px; color: ${({ theme }) => theme.colors.textSecondary}; }
    @media (max-width: 580px) { th, td { padding: 10px 8px; } }
`;
const CustomerName = styled.button`
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    padding: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font: inherit;
    font-weight: 600;
    overflow-wrap: anywhere;
    cursor: pointer;
    &:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 4px; border-radius: 2px; }
`;

type Props = {
    customers: Customer[];
    onOpenCustomer: (customerId: number) => void;
};

export default function CustomerDirectory({ customers, onOpenCustomer }: Props) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const search = query.trim().toLocaleLowerCase('de');
    const filtered = customers.filter((customer) => [customer.name, customer.email, customer.postalCode ?? '', customer.city, customer.industry].some((value) => value.toLocaleLowerCase('de').includes(search)));
    return (
        <>
            <FilterRow><Field>
                {t('Kunden suchen')}
                <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Name, E-Mail, Ort oder Branche')} />
            </Field>
            <ResultCount aria-live="polite">{t('{count} von {total} Kunden', { count: filtered.length, total: customers.length })}</ResultCount></FilterRow>
            <TableFrame>
                <Table aria-label={t('Kunden')}>
                    <thead><tr><th scope="col">{t('Name')}</th><th scope="col">{t('Branche')}</th><th scope="col">{t('Ort')}</th></tr></thead>
                    <tbody>
                        {filtered.map(customer => <tr key={customer.id} data-customer={customer.id} onClick={() => onOpenCustomer(customer.id)}>
                            <th scope="row"><CustomerName onClick={event => { event.stopPropagation(); onOpenCustomer(customer.id); }}>{customer.name}</CustomerName></th>
                            <td>{customer.industry || '—'}</td><td>{customer.city || '—'}</td>
                        </tr>)}
                        {filtered.length === 0 && <tr><td className="empty" colSpan={3}>{t(customers.length === 0 ? 'Noch keine Kunden vorhanden. Lege den ersten Kunden an.' : 'Keine Kunden für diese Suche gefunden.')}</td></tr>}
                    </tbody>
                </Table>
            </TableFrame>
        </>
    );
}
