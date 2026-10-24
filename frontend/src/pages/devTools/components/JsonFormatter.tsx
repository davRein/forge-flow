import { useTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { formatJson, validateJson } from '../utils/jsonLogic';
import CopyButton from './CopyButton';
import { Actions, Card, Columns, ErrorText, Field, Muted, PrimaryButton, SecondaryButton, Select, Textarea } from '../styles/toolStyles';

export default function JsonFormatter() {
    const { t } = useTranslation();
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
        <h2>{t('JSON formatieren und prüfen')}</h2>
        <Muted>{t('Einrücken, komprimieren oder die Syntax prüfen. Zahlen und Zeichenfolgen bleiben beim Formatieren unverändert.')}</Muted>
        <Actions>
            <Field>{t('Einrückung')}<Select value={indent} onChange={(event) => setIndent(event.target.value)}>
                <option value="  ">{t('2 Leerzeichen')}</option><option value="    ">{t('4 Leerzeichen')}</option><option value={'\t'}>{t('Tabulator')}</option>
            </Select></Field>
            <PrimaryButton onClick={() => transform(indent)}>{t('Formatieren')}</PrimaryButton>
            <SecondaryButton onClick={() => transform(null)}>{t('Komprimieren')}</SecondaryButton>
            <SecondaryButton onClick={() => {
                const failure = validateJson(source); setError(failure ?? ''); setMessage(failure ? '' : 'Gültiges JSON.');
            }}>{t('Validieren')}</SecondaryButton>
            <SecondaryButton onClick={() => { setSource(''); setOutput(''); setError(''); setMessage(''); }}>{t('Leeren')}</SecondaryButton>
        </Actions>
        {error && <ErrorText role="alert">{t(error)}</ErrorText>}
        <p role="status">{t(message)}</p>
        <Columns>
            <Field>{t('Eingabe')}<Textarea spellCheck={false} value={source} style={{ minHeight: 220, height: 'clamp(220px, 32vh, 320px)' }} placeholder={t('{\n  "projekt": "Dev Suite",\n  "aktiv": true\n}')} onChange={(event) => {
                setSource(event.target.value); setOutput(''); setError(''); setMessage('');
            }} /></Field>
            <div>
                <Field>{t('Ausgabe')}<Textarea spellCheck={false} readOnly value={output} style={{ minHeight: 220, height: 'clamp(220px, 32vh, 320px)' }} placeholder={t('Das Ergebnis erscheint hier.')} /></Field>
                <Actions><CopyButton text={output} /></Actions>
            </div>
        </Columns>
    </Card>;
}
