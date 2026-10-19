import { useEffect, useMemo, useRef, useState } from 'react';
import { executeRequest, formatResponseBody, httpMethods, prepareRequest } from '../utils/restLogic';
import type { HttpMethod, RequestDraft, RequestResult } from '../utils/restLogic';
import CopyButton from './CopyButton';
import { Actions, Card, Columns, DangerButton, ErrorText, Field, FormGrid, Input, Muted, PrimaryButton, SecondaryButton, Select, Table, Textarea } from '../styles/toolStyles';

const initialRequest: RequestDraft = { method: 'GET', url: '', headers: '', body: '', bodyType: 'none', timeout: 30 };

export default function RestClient() {
    const [draft, setDraft] = useState<RequestDraft>(initialRequest);
    const [response, setResponse] = useState<RequestResult | null>(null);
    const [formatted, setFormatted] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const controllerRef = useRef<AbortController | null>(null);
    useEffect(() => () => { controllerRef.current?.abort('unmount'); }, []);
    const bodyAllowed = draft.method !== 'GET' && draft.method !== 'HEAD';
    const responseBody = useMemo(() => response ? formatted && !response.truncated ? formatResponseBody(response.body) : response.body : '', [response, formatted]);

    function change(next: Partial<RequestDraft>) { setDraft((current) => ({ ...current, ...next })); setError(''); }

    async function send() {
        if (controllerRef.current) return;
        try { prepareRequest(draft); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Bitte die Anfrage prüfen.'); return; }
        const controller = new AbortController();
        controllerRef.current = controller;
        setPending(true); setResponse(null); setError('');
        const timeout = window.setTimeout(() => controller.abort('timeout'), draft.timeout * 1000);
        try {
            const result = await executeRequest(draft, controller.signal);
            if (!controller.signal.aborted) setResponse(result);
        } catch (failure) {
            if (controller.signal.reason === 'unmount') return;
            setError(controller.signal.aborted ? controller.signal.reason === 'timeout'
                ? `Zeitlimit von ${draft.timeout} Sekunden erreicht.` : 'Anfrage abgebrochen.'
                : `${failure instanceof Error ? failure.message : 'Netzwerkfehler'}. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen.`);
        } finally {
            window.clearTimeout(timeout);
            if (controllerRef.current === controller) { controllerRef.current = null; setPending(false); }
        }
    }

    return <>
        <Card>
            <h2>HTTP-Anfrage testen</h2>
            <Muted>Die Anfrage wird beim Senden direkt aus deinem Browser an die angegebene Adresse geschickt. Der Zielserver muss CORS erlauben. Cookies werden nicht mitgesendet; Zugangsdaten können als Header angegeben werden.</Muted>
            <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
                <FormGrid>
                    <Field>Methode<Select value={draft.method} disabled={pending} onChange={(event) => change({ method: event.target.value as HttpMethod })}>
                        {httpMethods.map((method) => <option key={method}>{method}</option>)}
                    </Select></Field>
                    <Field>Zeitlimit in Sekunden<Input type="number" min={1} max={120} step={1} disabled={pending} value={Number.isNaN(draft.timeout) ? '' : draft.timeout}
                        onChange={(event) => change({ timeout: event.target.valueAsNumber })} /></Field>
                </FormGrid>
                <Field style={{ marginTop: 16 }}>Adresse<Input required type="url" value={draft.url} disabled={pending} placeholder="https://dein-server.example/api/projekte" spellCheck={false} autoComplete="off"
                    onChange={(event) => change({ url: event.target.value })} /></Field>
                <Columns style={{ marginTop: 16 }}>
                    <Field>Header (Name: Wert, je eine Zeile)<Textarea spellCheck={false} value={draft.headers} disabled={pending} onChange={(event) => change({ headers: event.target.value })} placeholder={'Accept: application/json\nAuthorization: Bearer …'} /></Field>
                    <div>
                        <Field>Inhaltstyp<Select value={draft.bodyType} disabled={pending || !bodyAllowed} onChange={(event) => change({ bodyType: event.target.value as RequestDraft['bodyType'] })}>
                            <option value="none">Kein Body</option><option value="json">JSON</option><option value="text">Text</option>
                        </Select></Field>
                        <Field style={{ marginTop: 12 }}>Request-Body<Textarea spellCheck={false} value={draft.body} disabled={pending || !bodyAllowed || draft.bodyType === 'none'}
                            onChange={(event) => change({ body: event.target.value })} placeholder={'{ "name": "Beispiel" }'} /></Field>
                        {!bodyAllowed && <Muted>GET und HEAD werden ohne Body gesendet. Der Entwurf bleibt erhalten.</Muted>}
                    </div>
                </Columns>
                <Actions><PrimaryButton type="submit" disabled={pending || !draft.url.trim()}>{pending ? 'Anfrage läuft …' : 'Anfrage senden'}</PrimaryButton>
                    {pending && <DangerButton type="button" onClick={() => controllerRef.current?.abort('user')}>Abbrechen</DangerButton>}
                    <SecondaryButton type="button" disabled={pending} onClick={() => { setDraft(initialRequest); setResponse(null); setError(''); }}>Zurücksetzen</SecondaryButton>
                </Actions>
            </form>
            <p role="status">{pending ? 'Anfrage läuft. Sie kann abgebrochen werden.' : ''}</p>
            {error && <ErrorText role="alert">{error}</ErrorText>}
        </Card>
        {response && <Card aria-label="HTTP-Antwort">
            <h2>Antwort: {response.status} {response.statusText}</h2>
            <p role="status">{response.ok ? 'HTTP-Anfrage erfolgreich.' : 'Der Server hat einen HTTP-Fehlerstatus geliefert.'} {response.duration} ms · {response.bytes.toLocaleString('de-DE')} Byte{response.truncated ? ' angezeigt' : ''}</p>
            <Muted>{response.method} {response.url}</Muted>
            {response.truncated && <ErrorText>Die Anzeige wurde nach 2 MiB begrenzt. Der verbleibende Download wurde abgebrochen.</ErrorText>}
            <details><summary>Antwort-Header ({response.headers.length})</summary>
                {response.headers.length > 0 ? <Table><thead><tr><th>Name</th><th>Wert</th></tr></thead><tbody>{response.headers.map(([name, value]) => <tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></Table> : <Muted>Keine sichtbaren Antwort-Header.</Muted>}
            </details>
            <Muted>Der Browser zeigt nur Header an, die der Server für den Zugriff freigibt. Der Antwortinhalt wird als UTF-8-Text dargestellt.</Muted>
            <Actions><SecondaryButton aria-pressed={formatted} onClick={() => setFormatted((current) => !current)}>{formatted ? 'Rohtext anzeigen' : 'JSON formatieren'}</SecondaryButton><CopyButton text={responseBody} /></Actions>
            <Field>Antwortinhalt<Textarea readOnly spellCheck={false} value={responseBody} style={{ minHeight: 300 }} placeholder="Die Antwort enthält keinen Body." /></Field>
        </Card>}
    </>;
}
