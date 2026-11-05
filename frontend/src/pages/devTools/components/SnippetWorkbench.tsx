import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { useDeveloper } from '../../../hooks/developerContext';
import { useAuth } from '../../../hooks/authContext';
import { useTranslation } from '../../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../../hooks/navigationGuard';
import { languages, type CodeLanguage, type Snippet, type PreparedSql, type SqlResult } from '../../../services/developer/developer';
import { Actions, Card, Columns, Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, DangerButton, Muted, Table } from '../styles/toolStyles';
import CodePreview from './CodePreview';
import DeveloperStatus from './DeveloperStatus';
import DatabaseConnections from './DatabaseConnections';
import Dialog from '../../../components/ui/Dialog';

type Draft = { id?: string; title: string; language: CodeLanguage; prompt: string; code: string };
const blank = (sql: boolean): Draft => ({ title: '', language: sql ? 'sql' : 'typescript', prompt: '', code: '' });
export default function SnippetWorkbench({ active, sql = false }: { active: boolean; sql?: boolean }) {
    const { t: tx } = useUiTranslation();

    const dev = useDeveloper(active); const { t } = useTranslation(); const { user } = useAuth(); const guard = useNavigationGuard();
    const [draft, setDraft] = useState(() => blank(sql)); const [base, setBase] = useState(() => JSON.stringify(blank(sql)));
    const [message, setMessage] = useState(''); const [truncated, setTruncated] = useState(false);
    const [connection, setConnection] = useState(''); const [readOnly, setReadOnly] = useState(true);
    const [prepared, setPrepared] = useState<PreparedSql | null>(null); const [results, setResults] = useState<SqlResult[] | null>(null);
    const [deleting, setDeleting] = useState<Snippet | null>(null);
    const dirty = JSON.stringify(draft) !== base;
    const reset = () => { setDraft(blank(sql)); setBase(JSON.stringify(blank(sql))); setMessage(''); setTruncated(false); setPrepared(null); setResults(null); };
    useUnsavedChanges(active && dirty, reset, active && dev.busy);
    const blocked = dev.busy || dev.status !== 'ready';
    const external = dev.remote && dev.data.integrationsConfigured && !user?.expiresAt;
    const change = (patch: Partial<Draft>) => { setDraft(before => ({ ...before, ...patch })); setMessage(''); setPrepared(null); setResults(null); };
    const run = async (operation: () => Promise<void>) => { setMessage(''); try { await operation(); } catch { /* Provider retains error and draft. */ } };
    const open = (value: Snippet) => guard.request(() => { const next = { id: value.id, title: value.title, language: value.language, prompt: value.prompt, code: value.code }; setDraft(next); setBase(JSON.stringify(next)); setMessage(''); setResults(null); setTruncated(false); });
    return <>
        <DeveloperStatus />
        {sql && <DatabaseConnections active={active} />}
        <Columns>
            <Card><h2>{t(sql ? 'Gespeicherte SQL-Skripte' : 'Gespeicherte Snippets')}</h2>
                <Actions><SecondaryButton disabled={blocked} onClick={() => guard.request(reset)}>{t('Neu')}</SecondaryButton><SecondaryButton disabled={blocked || !dev.remote} onClick={() => guard.request(() => void dev.load())}>{t('Neu laden')}</SecondaryButton></Actions>
                {dev.data.snippets.filter(item => item.kind === (sql ? 'sql' : 'snippet')).map(item => <Actions key={item.id}>
                    <SecondaryButton disabled={blocked} aria-pressed={draft.id === item.id} onClick={() => open(item)}>{item.title} · {item.language}</SecondaryButton>
                    <DangerButton disabled={blocked} aria-label={t('Snippet löschen: {name}', { name: item.title })} onClick={() => setDeleting(item)}>{t('Löschen')}</DangerButton>
                </Actions>)}
                <Muted>{t('Snippets und SQL-Skripte sind privat für dein Konto.')}</Muted>
            </Card>
            <Card><h2>{t(sql ? 'SQL bearbeiten' : 'Snippet bearbeiten')}</h2>
                <form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await dev.saveSnippet({ ...draft, kind: sql ? 'sql' : 'snippet' }); const next = { id: saved.id, title: saved.title, language: saved.language, prompt: saved.prompt, code: saved.code }; setDraft(next); setBase(JSON.stringify(next)); setMessage('Gespeichert.'); }); }}>
                    <Field>{t('Titel')}<Input required disabled={blocked} maxLength={200} value={draft.title} onChange={e => change({ title: e.target.value })} /></Field>
                    <Field>{t('Programmiersprache')}<Select disabled={blocked || sql} value={draft.language} onChange={e => change({ language: e.target.value as CodeLanguage })}>{languages.filter(item => !sql || item === 'sql').map(item => <option key={item}>{item}</option>)}</Select></Field>
                    {sql && <><Field>{t('Datenbankverbindung')}<Select disabled={blocked || !external} value={connection} onChange={e => { setConnection(e.target.value); setPrepared(null); setResults(null); }}><option value="">{t('Bitte auswählen')}</option>{dev.data.connections.map(item => <option key={item.id} value={item.id}>{item.name} · {item.database}</option>)}</Select></Field><Muted>{t('Die KI erhält nur deine Beschreibung und den SQL-Dialekt. Zugangsdaten und Datenbankschema werden nicht an die KI übermittelt.')}</Muted></>}
                    <Field>{t('Anweisung an die KI')}<Textarea disabled={blocked} maxLength={8000} value={draft.prompt} onChange={e => change({ prompt: e.target.value })} /></Field>
                    <Actions><SecondaryButton type="button" disabled={blocked || !dev.remote || !draft.prompt.trim() || (sql && (!external || !connection))} onClick={() => void run(async () => { const result = await dev.request<{ code: string; truncated: boolean }>('/generate', { language: draft.language, instructions: draft.prompt, kind: sql ? 'sql' : 'snippet', connectionId: sql ? connection : null }); change({ code: result.code }); setTruncated(result.truncated); setMessage('Code generiert. Bitte vor der Verwendung prüfen und speichern.'); })}>{t('Mit KI generieren')}</SecondaryButton></Actions>
                    <Field>{t('Quellcode')}<Textarea spellCheck={false} disabled={blocked} maxLength={sql ? 100000 : 200000} style={{ minHeight: 250 }} value={draft.code} onChange={e => change({ code: e.target.value })} /></Field>
                    {draft.code && <CodePreview code={draft.code} language={draft.language} />}
                    {truncated && <p role="alert">{t('Die KI-Antwort wurde abgeschnitten. Der Code kann unvollständig sein.')}</p>}
                    <Actions><PrimaryButton type="submit" disabled={blocked || !dirty || !draft.title.trim()}>{t('Speichern')}</PrimaryButton><SecondaryButton type="button" disabled={blocked} onClick={() => guard.request(reset)}>{t('Verwerfen')}</SecondaryButton>{dirty && <span>{t('Ungespeicherte Änderungen')}</span>}</Actions>
                </form>
                {sql && <>
                    <Field><span><input type="checkbox" checked={readOnly} disabled={blocked} onChange={e => { setReadOnly(e.target.checked); setPrepared(null); }} /> {t('Nur lesen')}</span></Field>
                    <Muted>{t('Ausführung erfolgt auf dem Server als eigene Transaktion mit Zeit- und Ergebnislimit. Schreibaktionen können Daten dauerhaft verändern. Die Rechte der Datenbankrolle gelten.')}</Muted>
                    <Actions><DangerButton disabled={blocked || !external || !connection || !draft.code.trim()} onClick={() => void run(async () => { const ticket = await dev.request<PreparedSql>(`/connections/${connection}/prepare`, { sql: draft.code, readOnly }); setPrepared(ticket); })}>{t('Ausführung prüfen …')}</DangerButton></Actions>
                </>}
                {message && <p role="status">{t(message)}</p>}
                {dev.busy && <p role="status">{t('Anfrage läuft …')}</p>}
            </Card>
        </Columns>
        {prepared && <Dialog title={t('SQL-Ausführung bestätigen')} onClose={() => { if (!dev.busy) setPrepared(null); }} width={820}>
            <p>{prepared.target.name} · {prepared.target.username}@{prepared.target.host}:{prepared.target.port}/{prepared.target.database}</p>
            <p>{t(prepared.readOnly ? 'Modus: nur lesen' : 'Modus: Schreiben erlaubt – Daten können geändert oder gelöscht werden.')}</p>
            <CodePreview code={prepared.sql} language="sql" />
            <Muted>{t('Diese Bestätigung gilt einmalig für genau diesen SQL-Text und diese Verbindung, maximal zwei Minuten.')}</Muted>
            <Actions><DangerButton disabled={blocked} onClick={() => { const ticket = prepared.ticket; setPrepared(null); void run(async () => { setResults(null); const value = await dev.request<SqlResult[]>('/connections/execute', { ticket }); setResults(value); setMessage('SQL-Ausführung abgeschlossen.'); }); }}>{t('Jetzt ausführen')}</DangerButton><SecondaryButton disabled={blocked} onClick={() => setPrepared(null)}>{t('Abbrechen')}</SecondaryButton></Actions>
        </Dialog>}
        {results && <Card><h2>{t('Ergebnisse')}</h2>{results.map((result, index) => <div key={index} style={{ overflowX: 'auto', marginBottom: 16 }}>
            {result.columns.length > 0 ? <Table><thead><tr>{result.columns.map((name, i) => <th key={i}>{name}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value === null ? tx('NULL') : value}</td>)}</tr>)}</tbody></Table> : <p>{t('Betroffene Zeilen: {count}', { count: result.affected })}</p>}
            {result.truncated && <Muted>{t('Ergebnis begrenzt: maximal 200 Zeilen je Ergebnis; lange Werte werden gekürzt.')}</Muted>}
        </div>)}</Card>}
        {deleting && <Dialog title={t('Snippet löschen?')} onClose={() => { if (!dev.busy) setDeleting(null); }}><p>{deleting.title}</p><Actions><DangerButton disabled={blocked} onClick={() => void run(async () => { await dev.deleteSnippet(deleting.id); if (draft.id === deleting.id) reset(); setDeleting(null); })}>{t('Löschen')}</DangerButton><SecondaryButton disabled={blocked} onClick={() => setDeleting(null)}>{t('Abbrechen')}</SecondaryButton></Actions></Dialog>}
    </>;
}
