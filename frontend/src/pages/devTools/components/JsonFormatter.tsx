import { useState } from 'react';
import { formatJson, validateJson } from '../utils/jsonLogic';
import CopyButton from './CopyButton';
import { Actions, Card, Columns, ErrorText, Field, Muted, PrimaryButton, SecondaryButton, Select, Textarea } from '../styles/toolStyles';

export default function JsonFormatter() {
    const [source, setSource] = useState('');
    const [output, setOutput] = useState('');
    const [indent, setIndent] = useState('  ');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    function transform(indentation: string | null) {
        try { setOutput(formatJson(source, indentation)); setError(''); setMessage(indentation === null ? 'JSON komprimiert.' : 'JSON formatiert.'); }
        catch (failure) { setOutput(''); setMessage(''); setError(failure instanceof Error ? failure.message : 'JSON konnte nicht formatiert werden.'); }
    }

    return <Card>
        <h2>JSON formatieren und prüfen</h2>
        <Muted>Einrücken, komprimieren oder die Syntax prüfen. Zahlen und Zeichenfolgen bleiben beim Formatieren unverändert.</Muted>
        <Actions>
            <Field>Einrückung<Select value={indent} onChange={(event) => setIndent(event.target.value)}>
                <option value="  ">2 Leerzeichen</option><option value="    ">4 Leerzeichen</option><option value={'\t'}>Tabulator</option>
            </Select></Field>
            <PrimaryButton onClick={() => transform(indent)}>Formatieren</PrimaryButton>
            <SecondaryButton onClick={() => transform(null)}>Komprimieren</SecondaryButton>
            <SecondaryButton onClick={() => {
                const failure = validateJson(source); setError(failure ?? ''); setMessage(failure ? '' : 'Gültiges JSON.');
            }}>Validieren</SecondaryButton>
            <SecondaryButton onClick={() => { setSource(''); setOutput(''); setError(''); setMessage(''); }}>Leeren</SecondaryButton>
        </Actions>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <p role="status">{message}</p>
        <Columns>
            <Field>Eingabe<Textarea spellCheck={false} value={source} style={{ minHeight: 380 }} placeholder={'{\n  "projekt": "Dev Suite",\n  "aktiv": true\n}'} onChange={(event) => {
                setSource(event.target.value); setOutput(''); setError(''); setMessage('');
            }} /></Field>
            <div>
                <Field>Ausgabe<Textarea spellCheck={false} readOnly value={output} style={{ minHeight: 380 }} placeholder="Das Ergebnis erscheint hier." /></Field>
                <Actions><CopyButton text={output} /></Actions>
            </div>
        </Columns>
    </Card>;
}
