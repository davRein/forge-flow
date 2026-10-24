import { useState } from 'react';
import { useTranslation } from '../../../hooks/languageContext';
import type { RestCollection, SavedRestRequest } from '../../../services/rest/restCollections';
import { ErrorText, Input, Muted } from '../styles/toolStyles';
import { Library } from '../styles/restStyles';

type Props = { collections: RestCollection[]; selectedId?: string; busy: boolean; status: string; error: string | null; persistence: 'account' | 'session';
    onCreate: () => void; onRename: (collection: RestCollection) => void; onDelete: (collection: RestCollection) => void;
    onLoad: (collectionId: string, request: SavedRestRequest) => void; onDeleteRequest: (collectionId: string, request: SavedRestRequest) => void; onReload: () => void };

function Icon({ kind }: { kind: 'folder' | 'edit' | 'delete' }) {
    return <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={kind === 'folder' ? 'M3 7V5h6l3 3h9v12H3V7h18' : kind === 'edit' ? 'm15 4 5 5M4 20l4-1L21 6l-4-4L4 15z' : 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'} />
    </svg>;
}
export default function RestLibrary({ collections, selectedId, busy, status, error, persistence, onCreate, onRename, onDelete, onLoad, onDeleteRequest, onReload }: Props) {
    const { t } = useTranslation();
    const [query, setQuery] = useState(''); const [closed, setClosed] = useState(new Set<string>());
    const search = query.trim().toLocaleLowerCase();
    const visible = collections.map(collection => ({ ...collection, requests: collection.requests.filter(request => !search || `${collection.name} ${request.name} ${request.draft.url}`.toLocaleLowerCase().includes(search)) }))
        .filter(collection => !search || collection.name.toLocaleLowerCase().includes(search) || collection.requests.length > 0);
    return <Library aria-label={t('Gespeicherte Collections')}>
        <header><h2>Collections</h2><button type="button" disabled={busy || status !== 'ready'} aria-label={t('Collection anlegen')} title={t('Collection anlegen')} onClick={onCreate}>+</button></header>
        <Input type="search" aria-label={t('Collections durchsuchen')} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Collections durchsuchen')} />
        {status === 'idle' || status === 'loading' ? <Muted role="status">{t('Collections werden geladen …')}</Muted> : null}
        {error && <><ErrorText role="alert">{t(error)}</ErrorText><button type="button" disabled={status === 'loading' || status === 'saving'} onClick={onReload}>{t('Collections neu laden')}</button></>}
        {status === 'ready' && collections.length === 0 && <Muted>{t('Noch keine Collections. Speichere deine erste Anfrage oder lege eine Collection an.')}</Muted>}
        {status === 'ready' && collections.length > 0 && visible.length === 0 && <Muted>{t('Keine passenden Collections oder Anfragen.')}</Muted>}
        <div className="collection-list"><ul>{visible.map(collection => {
            const open = !!search || !closed.has(collection.id);
            return <li key={collection.id}><div className="collection-row">
                <button type="button" aria-expanded={open} aria-controls={`rest-collection-${collection.id}`} onClick={() => setClosed(current => { const next = new Set(current); if (open) next.add(collection.id); else next.delete(collection.id); return next; })}>
                    <Icon kind="folder" /> {collection.name} <small>({collection.requests.length})</small>
                </button>
                <button type="button" disabled={busy} title={t('Collection umbenennen')} aria-label={t('Collection umbenennen: {name}', { name: collection.name })} onClick={() => onRename(collection)}><Icon kind="edit" /></button>
                <button type="button" disabled={busy} title={t('Collection löschen')} aria-label={t('Collection löschen: {name}', { name: collection.name })} onClick={() => onDelete(collection)}><Icon kind="delete" /></button>
            </div><ul id={`rest-collection-${collection.id}`} hidden={!open}>{collection.requests.map(request => <li key={request.id} className="request-row">
                <button className="request" type="button" disabled={busy} aria-current={selectedId === request.id ? 'page' : undefined} title={request.draft.url} onClick={() => onLoad(collection.id, request)}><span>{request.draft.method}</span><span>{request.name}</span></button>
                <button type="button" disabled={busy} title={t('Anfrage löschen')} aria-label={t('Anfrage löschen: {name}', { name: request.name })} onClick={() => onDeleteRequest(collection.id, request)}><Icon kind="delete" /></button>
            </li>)}</ul></li>;
        })}</ul></div>
        <Muted>{t(persistence === 'account' ? 'Collections werden privat in deinem Konto gespeichert.' : 'Collections gelten in der lokalen Vorschau nur für diese Sitzung.')}</Muted>
    </Library>;
}
