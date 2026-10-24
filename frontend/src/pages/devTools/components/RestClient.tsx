import { useTranslation } from '../../../hooks/languageContext';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRestCollections } from '../../../hooks/restCollectionsContext';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import type { RestCollection, SavedRestRequest } from '../../../services/rest/restCollections';
import { executeRequest, formatResponseBody, httpMethods, prepareRequest } from '../utils/restLogic';
import type { HttpMethod, RequestDraft, RequestResult } from '../utils/restLogic';
import Dialog from '../../../components/ui/Dialog';
import { SaveToast } from '../../../components/ui/SaveToast';
import CopyButton from './CopyButton';
import RestLibrary from './RestLibrary';
import { Actions, Card, DangerButton, ErrorText, Field, Input, Muted, PrimaryButton, SecondaryButton, Select, Table, Textarea } from '../styles/toolStyles';
import { RequestHeader, RequestLine, RequestTabs, RestLayout, ToastPosition } from '../styles/restStyles';

const initialRequest: RequestDraft = { method: 'GET', url: '', headers: '', body: '', bodyType: 'none', timeout: 30 };
const tabs = ['headers', 'body', 'options'] as const;
const fingerprint = (value: RequestDraft) => JSON.stringify([value.method, value.url, value.headers, value.body, value.bodyType, value.timeout]);
const sameRequest = (a: SavedRestRequest, b: SavedRestRequest) => a.id === b.id && a.name === b.name && fingerprint(a.draft) === fingerprint(b.draft);
type Selection = { collectionId: string; request: SavedRestRequest };
type Modal = { kind: 'collection'; original?: RestCollection; name: string }
    | { kind: 'save'; update: boolean; name: string; collectionId: string; collectionName: string }
    | { kind: 'delete'; collection: RestCollection; request?: SavedRestRequest }
    | { kind: 'replace'; selection: Selection | null };

export default function RestClient({ active = true }: { active?: boolean }) {
    const { t, locale } = useTranslation();
    const library = useRestCollections();
    const [draft, setDraft] = useState<RequestDraft>(initialRequest);
    const [loaded, setLoaded] = useState<Selection | null>(null);
    const [modal, setModal] = useState<Modal | null>(null);
    const [modalError, setModalError] = useState('');
    const [toast, setToast] = useState(false);
    const [tab, setTab] = useState<'headers' | 'body' | 'options'>('headers');
    const tabsId = useId();
    const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
    const [response, setResponse] = useState<RequestResult | null>(null);
    const [formatted, setFormatted] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const controllerRef = useRef<AbortController | null>(null);
    useEffect(() => () => { controllerRef.current?.abort('unmount'); }, []);
    useEffect(() => { if (active && library.status === 'idle') void library.store.load(); }, [active, library.status, library.store]);
    const dirty = fingerprint(draft) !== fingerprint(loaded?.request.draft ?? initialRequest);
    const saving = library.status === 'saving';
    const canSave = library.status === 'ready' && !pending;
    useChatNavigationBlocker(dirty || !!modal || saving);
    const bodyAllowed = draft.method !== 'GET' && draft.method !== 'HEAD';
    const responseBody = useMemo(() => response ? formatted && !response.truncated ? formatResponseBody(response.body) : response.body : '', [response, formatted]);
    const collections = library.data?.collections ?? [];

    function change(next: Partial<RequestDraft>) { setDraft(current => ({ ...current, ...next })); setError(''); }
    function showModal(value: Modal) { setModalError(''); setModal(value); }
    function applyLoad(selection: Selection | null) { setLoaded(selection); setDraft({ ...(selection?.request.draft ?? initialRequest) }); setResponse(null); setError(''); setModal(null); }
    function load(selection: Selection | null) { if (pending) return; if (dirty) showModal({ kind: 'replace', selection }); else applyLoad(selection); }
    function saveDialog(update: boolean) { showModal({ kind: 'save', update, name: loaded?.request.name ?? '', collectionId: update && loaded ? loaded.collectionId : collections[0]?.id ?? '', collectionName: '' }); }
    async function persist(next: RestCollection[]) {
        const success = await library.store.save(next);
        if (success) { setModal(null); setModalError(''); setToast(true); }
        return success;
    }
    async function saveModal() {
        if (!modal || saving) return;
        if (modal.kind === 'collection') {
            if (!modal.name.trim()) { setModalError('Bitte einen Namen angeben.'); return; }
            if (modal.original) {
                const current = collections.find(entry => entry.id === modal.original!.id);
                if (!current || current.name !== modal.original.name) { setModalError('Diese Collection wurde inzwischen geändert. Bitte neu laden.'); return; }
                await persist(collections.map(entry => entry.id === current.id ? { ...entry, name: modal.name.trim() } : entry));
            } else await persist([...collections, { id: crypto.randomUUID(), name: modal.name.trim(), requests: [] }]);
        } else if (modal.kind === 'save') {
            if (!modal.name.trim() || !modal.collectionId && !modal.collectionName.trim()) { setModalError('Bitte Anfrage- und Collectionnamen angeben.'); return; }
            if (modal.update && loaded) {
                const current = collections.find(entry => entry.id === loaded.collectionId)?.requests.find(entry => entry.id === loaded.request.id);
                if (!current || !sameRequest(current, loaded.request)) { setModalError('Die gespeicherte Anfrage wurde inzwischen geändert. Bitte lade sie erneut oder speichere eine Kopie.'); return; }
            }
            const collectionId = modal.collectionId || crypto.randomUUID();
            const request: SavedRestRequest = { id: modal.update && loaded ? loaded.request.id : crypto.randomUUID(), name: modal.name.trim(), draft: { ...draft } };
            let next = collections;
            if (!modal.collectionId) next = [...next, { id: collectionId, name: modal.collectionName.trim(), requests: [] }];
            if (!next.some(entry => entry.id === collectionId)) { setModalError('Diese Collection ist nicht mehr vorhanden.'); return; }
            next = next.map(entry => entry.id === collectionId ? { ...entry, requests: modal.update ? entry.requests.map(existing => existing.id === request.id ? request : existing) : [...entry.requests, request] } : entry);
            if (await persist(next)) setLoaded({ collectionId, request });
        } else if (modal.kind === 'delete') {
            const current = collections.find(entry => entry.id === modal.collection.id);
            if (!current || (modal.request ? !current.requests.some(request => sameRequest(request, modal.request!)) : JSON.stringify(current) !== JSON.stringify(modal.collection))) { setModalError('Diese Collection wurde inzwischen geändert. Bitte neu laden.'); return; }
            const next = modal.request ? collections.map(entry => entry.id === current.id ? { ...entry, requests: entry.requests.filter(request => request.id !== modal.request!.id) } : entry) : collections.filter(entry => entry.id !== current.id);
            if (await persist(next)) if (loaded?.collectionId === current.id && (!modal.request || loaded.request.id === modal.request.id)) setLoaded(null);
        }
    }
    async function send() {
        if (controllerRef.current) return;
        try { prepareRequest(draft); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Bitte die Anfrage prüfen.'); return; }
        const controller = new AbortController(); controllerRef.current = controller;
        const sent = { ...draft }; setPending(true); setResponse(null); setError('');
        const timeout = globalThis.setTimeout(() => controller.abort('timeout'), sent.timeout * 1000);
        try { const result = await executeRequest(sent, controller.signal); if (!controller.signal.aborted) setResponse(result); }
        catch (failure) {
            if (controller.signal.reason === 'unmount') return;
            setError(controller.signal.aborted ? controller.signal.reason === 'timeout' ? `Zeitlimit von ${sent.timeout} Sekunden erreicht.` : 'Anfrage abgebrochen.'
                : `${failure instanceof Error ? failure.message : 'Netzwerkfehler'}. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen.`);
        } finally { globalThis.clearTimeout(timeout); if (controllerRef.current === controller) { controllerRef.current = null; setPending(false); } }
    }

    return <>
        <RestLayout>
            <RestLibrary collections={collections} selectedId={loaded?.request.id} busy={pending || saving || library.status !== 'ready'} status={library.status} error={library.error} persistence={library.store.persistence}
                onCreate={() => showModal({ kind: 'collection', name: '' })} onRename={original => showModal({ kind: 'collection', original, name: original.name })}
                onDelete={collection => showModal({ kind: 'delete', collection })} onDeleteRequest={(collectionId, request) => { const collection = collections.find(entry => entry.id === collectionId); if (collection) showModal({ kind: 'delete', collection, request }); }}
                onLoad={(collectionId, request) => load({ collectionId, request })} onReload={() => void library.store.load()} />
            <div><Card>
                <RequestHeader><h2>{loaded?.request.name ?? t('Neue Anfrage')}{dirty ? ' •' : ''}</h2><div className="actions">
                    <SecondaryButton type="button" disabled={pending} onClick={() => load(null)}>{t('Neue Anfrage')}</SecondaryButton>
                    <SecondaryButton type="button" disabled={!canSave} onClick={() => saveDialog(!!loaded)}>{t('Speichern')}</SecondaryButton>
                    {loaded && <SecondaryButton type="button" disabled={!canSave} onClick={() => saveDialog(false)}>{t('Speichern unter …')}</SecondaryButton>}
                </div></RequestHeader>
                <form aria-label={t('HTTP-Anfrage')} onSubmit={event => { event.preventDefault(); void send(); }}>
                    <RequestLine><Field>{t('Methode')}<Select value={draft.method} disabled={pending} onChange={event => change({ method: event.target.value as HttpMethod })}>{httpMethods.map(method => <option key={method}>{method}</option>)}</Select></Field>
                        <Field>{t('Adresse')}<Input required type="url" maxLength={4000} value={draft.url} disabled={pending} placeholder="https://example.com/api" spellCheck={false} autoComplete="off" onChange={event => change({ url: event.target.value })} /></Field>
                        <PrimaryButton type="submit" disabled={pending || !draft.url.trim()}>{pending ? t('Anfrage läuft …') : t('Anfrage senden')}</PrimaryButton>
                    </RequestLine>
                    <RequestTabs role="tablist" aria-label={t('Anfragedetails')}>{tabs.map((key, index) => <button key={key} type="button" role="tab" ref={node => { tabButtons.current[index] = node; }} tabIndex={tab === key ? 0 : -1} id={`${tabsId}-${key}`} aria-controls={`${tabsId}-panel-${key}`} aria-selected={tab === key}
                        onKeyDown={event => { let next = index; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = tabs.length - 1; else return; event.preventDefault(); setTab(tabs[next]); tabButtons.current[next]?.focus(); }}
                        onClick={() => setTab(key)}>{t(key === 'headers' ? 'Header' : key === 'body' ? 'Request-Body' : 'Optionen')}</button>)}</RequestTabs>
                    <div role="tabpanel" id={`${tabsId}-panel-headers`} aria-labelledby={`${tabsId}-headers`} hidden={tab !== 'headers'}><Field>{t('Header (Name: Wert, je eine Zeile)')}<Textarea maxLength={20000} spellCheck={false} value={draft.headers} disabled={pending} onChange={event => change({ headers: event.target.value })} placeholder={'Accept: application/json\nAuthorization: Bearer …'} /></Field></div>
                    <div role="tabpanel" id={`${tabsId}-panel-body`} aria-labelledby={`${tabsId}-body`} hidden={tab !== 'body'}>
                        <Field>{t('Inhaltstyp')}<Select value={draft.bodyType} disabled={pending || !bodyAllowed} onChange={event => change({ bodyType: event.target.value as RequestDraft['bodyType'] })}><option value="none">{t('Kein Body')}</option><option value="json">JSON</option><option value="text">Text</option></Select></Field>
                        <Field style={{ marginTop: 10 }}>{t('Request-Body')}<Textarea maxLength={100000} spellCheck={false} value={draft.body} disabled={pending || !bodyAllowed || draft.bodyType === 'none'} onChange={event => change({ body: event.target.value })} placeholder={t('{ "name": "Beispiel" }')} /></Field>
                        {!bodyAllowed && <Muted>{t('GET und HEAD werden ohne Body gesendet. Der Entwurf bleibt erhalten.')}</Muted>}
                    </div>
                    <div role="tabpanel" id={`${tabsId}-panel-options`} aria-labelledby={`${tabsId}-options`} hidden={tab !== 'options'}><Field>{t('Zeitlimit in Sekunden')}<Input type="number" min={1} max={120} step={1} disabled={pending} value={Number.isNaN(draft.timeout) ? '' : draft.timeout} onChange={event => change({ timeout: event.target.valueAsNumber })} /></Field></div>
                    {pending && <Actions><DangerButton type="button" onClick={() => controllerRef.current?.abort('user')}>{t('Abbrechen')}</DangerButton></Actions>}
                </form>
                <details style={{ marginTop: 10 }}><summary>{t('Verbindungshinweis')}</summary><Muted>{t('Die Anfrage wird beim Senden direkt aus deinem Browser an die angegebene Adresse geschickt. Der Zielserver muss CORS erlauben. Cookies werden nicht mitgesendet; Zugangsdaten können als Header angegeben werden.')}</Muted></details>
                <p role="status">{pending ? t('Anfrage läuft. Sie kann abgebrochen werden.') : ''}</p>{error && <ErrorText role="alert">{t(error)}</ErrorText>}
            </Card>
            {response ? <Card aria-label={t('HTTP-Antwort')}>
                <h2>{t('Antwort:')} {response.status} {response.statusText}</h2>
                <p role="status">{response.ok ? t('HTTP-Anfrage erfolgreich.') : t('Der Server hat einen HTTP-Fehlerstatus geliefert.')} {response.duration} ms · {response.bytes.toLocaleString(locale)} {t('Byte')}{response.truncated ? ` ${t('angezeigt')}` : ''}</p>
                <Muted>{response.method} {response.url}</Muted>
                {response.truncated && <ErrorText>{t('Die Anzeige wurde nach 2 MiB begrenzt. Der verbleibende Download wurde abgebrochen.')}</ErrorText>}
                <details><summary>{t('Antwort-Header')} ({response.headers.length})</summary>{response.headers.length ? <Table><thead><tr><th>{t('Name')}</th><th>{t('Wert')}</th></tr></thead><tbody>{response.headers.map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></Table> : <Muted>{t('Keine sichtbaren Antwort-Header.')}</Muted>}</details>
                <Actions><SecondaryButton aria-pressed={formatted} onClick={() => setFormatted(current => !current)}>{formatted ? t('Rohtext anzeigen') : t('JSON formatieren')}</SecondaryButton><CopyButton text={responseBody} /></Actions>
                <Field>{t('Antwortinhalt')}<Textarea readOnly spellCheck={false} value={responseBody} style={{ minHeight: 220 }} placeholder={t('Die Antwort enthält keinen Body.')} /></Field>
            </Card> : <Card><Muted>{t('Sende eine Anfrage, um die Antwort zu sehen.')}</Muted></Card>}
            </div>
        </RestLayout>
        {modal && <Dialog title={t(modal.kind === 'collection' ? modal.original ? 'Collection umbenennen' : 'Collection anlegen' : modal.kind === 'save' ? 'Anfrage speichern' : modal.kind === 'delete' ? modal.request ? 'Anfrage löschen?' : 'Collection löschen?' : 'Ungespeicherte Anfrage ersetzen?')} onClose={() => { if (!saving) setModal(null); }}>
            {modal.kind === 'replace' ? <><p>{t('Deine ungespeicherten Änderungen werden verworfen. Die geladene Anfrage wird nicht automatisch gesendet.')}</p><Actions><SecondaryButton onClick={() => setModal(null)}>{t('Abbrechen')}</SecondaryButton><PrimaryButton onClick={() => applyLoad(modal.selection)}>{t('Entwurf verwerfen und laden')}</PrimaryButton></Actions></>
                : <form onSubmit={event => { event.preventDefault(); void saveModal(); }}>
                    {modal.kind === 'collection' && <Field>{t('Name')}<Input autoFocus required maxLength={200} disabled={saving} value={modal.name} onChange={event => setModal({ ...modal, name: event.target.value })} /></Field>}
                    {modal.kind === 'save' && <><Field>{t('Anfragename')}<Input autoFocus required maxLength={200} disabled={saving} value={modal.name} onChange={event => setModal({ ...modal, name: event.target.value })} /></Field>
                        <Field style={{ marginTop: 12 }}>Collection<Select disabled={saving || modal.update} value={modal.collectionId} onChange={event => setModal({ ...modal, collectionId: event.target.value })}><option value="">{t('Neue Collection')}</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</Select></Field>
                        {!modal.collectionId && <Field style={{ marginTop: 12 }}>{t('Collectionname')}<Input required maxLength={200} value={modal.collectionName} disabled={saving} onChange={event => setModal({ ...modal, collectionName: event.target.value })} /></Field>}
                        <Muted>{t('Methode, URL, Header, Body und Zeitlimit werden gespeichert. Antworten werden nicht gespeichert.')}</Muted></>}
                    {modal.kind === 'delete' && <p>{modal.request ? t('„{name}“ wirklich löschen?', { name: modal.request.name }) : t('Collection „{name}“ mit {count} Anfragen wirklich löschen?', { name: modal.collection.name, count: modal.collection.requests.length })}</p>}
                    {(modalError || library.error) && <ErrorText role="alert">{t(modalError || library.error!)}</ErrorText>}
                    <Actions><SecondaryButton type="button" disabled={saving} onClick={() => setModal(null)}>{t('Abbrechen')}</SecondaryButton>{modal.kind === 'delete' ? <DangerButton type="submit" disabled={saving}>{t('Löschen')}</DangerButton> : <PrimaryButton type="submit" disabled={saving}>{t(saving ? 'Wird gespeichert …' : 'Speichern')}</PrimaryButton>}</Actions>
                </form>}
        </Dialog>}
        {toast && <ToastPosition role="status"><SaveToast kind="success" title={t('Collections gespeichert.')} onDismiss={() => setToast(false)} /></ToastPosition>}
    </>;
}
