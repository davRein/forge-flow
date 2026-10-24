import { useTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { calculate } from '../utils/calculatorLogic';
import CopyButton from './CopyButton';
import { Actions, Card, ErrorText, Field, Input, Keypad, Muted, PrimaryButton, Result, SecondaryButton, Table } from '../styles/toolStyles';

type Calculation = { expression: string; result: string };

export default function Calculator() {
    const { t } = useTranslation();
    const [expression, setExpression] = useState('');
    const [calculation, setCalculation] = useState<Calculation | null>(null);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<Calculation[]>([]);
    function change(value: string) { setExpression(value); setError(''); setCalculation(null); }
    function evaluate() {
        try {
            const entry = { expression: expression.trim(), result: String(calculate(expression)) };
            setCalculation(entry); setError(''); setHistory((current) => [entry, ...current].slice(0, 10));
        } catch (failure) { setCalculation(null); setError(failure instanceof Error ? failure.message : 'Der Ausdruck ist ungültig.'); }
    }
    return <>
        <Card>
            <h2>{t('Rechner')}</h2>
            <Muted>{t('Grundrechenarten, Klammern, Potenzen (^), Rest (%) und wissenschaftliche Schreibweise. Dezimalpunkt oder Dezimalkomma sind möglich.')}</Muted>
            <form onSubmit={(event) => { event.preventDefault(); evaluate(); }}>
                <Field>{t('Rechenausdruck')}<Input value={expression} onChange={(event) => change(event.target.value)} placeholder={t('(12,5 + 7,5) * 2^3')} maxLength={1000} autoComplete="off" /></Field>
                <Actions><PrimaryButton type="submit" disabled={!expression.trim()}>{t('Berechnen')}</PrimaryButton>
                    <SecondaryButton type="button" onClick={() => change('')}>{t('Leeren')}</SecondaryButton>
                    <SecondaryButton type="button" onClick={() => change(expression.slice(0, -1))} disabled={!expression}>{t('Letztes Zeichen löschen')}</SecondaryButton>
                </Actions>
            </form>
            <Keypad aria-label={t('Rechentasten')}>{['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '^', '+', '(', ')', '%', '='].map((key) =>
                <SecondaryButton key={key} onClick={() => key === '=' ? evaluate() : change(expression + key)} aria-label={key === '=' ? t('Ergebnis berechnen') : key}>{key}</SecondaryButton>)}</Keypad>
            {error && <ErrorText role="alert">{t(error)}</ErrorText>}
            <div aria-live="polite">{calculation && <><Result>{calculation.expression} = {calculation.result}</Result><Actions><CopyButton text={calculation.result} /></Actions></>}</div>
            <Muted>{t('Es gilt Punkt vor Strich. Potenzen werden von rechts ausgewertet: 2^3^2 = 512; -2^2 = -4. % berechnet den Rest einer Division. Dezimalergebnisse können Rundungsabweichungen enthalten.')}</Muted>
        </Card>
        <Card>
            <h2>{t('Letzte Berechnungen')}</h2>
            {history.length === 0 ? <Muted>{t('Noch keine Berechnungen in dieser Sitzung.')}</Muted> : <>
                <Table><thead><tr><th>{t('Ausdruck')}</th><th>{t('Ergebnis')}</th><th>{t('Aktion')}</th></tr></thead><tbody>{history.map((entry, index) => <tr key={index}>
                    <td>{entry.expression}</td><td>{entry.result}</td><td><SecondaryButton onClick={() => change(entry.expression)}>{t('Übernehmen')}</SecondaryButton></td>
                </tr>)}</tbody></Table>
                <Actions><SecondaryButton onClick={() => setHistory([])}>{t('Verlauf leeren')}</SecondaryButton></Actions>
            </>}
        </Card>
    </>;
}
