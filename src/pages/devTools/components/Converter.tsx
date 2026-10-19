import { useState } from 'react';
import { convertBase, convertText, convertUnit, unitGroups } from '../utils/converterLogic';
import type { TextConversion, UnitGroup } from '../utils/converterLogic';
import CopyButton from './CopyButton';
import { Actions, Card, Columns, ErrorText, Field, FormGrid, Input, Muted, PrimaryButton, Result, SecondaryButton, Select, Textarea } from '../styles/toolStyles';

type Outcome = { value: string; error: string };
function outcome(action: () => string): Outcome {
    try { return { value: action(), error: '' }; }
    catch (error) { return { value: '', error: error instanceof Error ? error.message : 'Die Eingabe ist ungültig.' }; }
}

function TextConverter() {
    const [mode, setMode] = useState<TextConversion>('base64Encode');
    const [input, setInput] = useState('');
    const [output, setOutput] = useState<Outcome>({ value: '', error: '' });
    function clearOutput() { setOutput({ value: '', error: '' }); }
    return <Card>
        <h2>Text kodieren und dekodieren</h2>
        <Muted>Base64 arbeitet mit UTF-8-Text. URL-Kodierung wandelt einen einzelnen URL-Bestandteil um.</Muted>
        <Field>Umwandlung<Select value={mode} onChange={(event) => { setMode(event.target.value as TextConversion); clearOutput(); }}>
            <option value="base64Encode">Text → Base64</option><option value="base64Decode">Base64 → Text</option>
            <option value="urlEncode">Text → URL-kodiert</option><option value="urlDecode">URL-kodiert → Text</option>
        </Select></Field>
        <Actions><PrimaryButton onClick={() => setOutput(outcome(() => convertText(input, mode)))}>Umwandeln</PrimaryButton>
            <SecondaryButton onClick={() => { setInput(''); clearOutput(); }}>Leeren</SecondaryButton>
        </Actions>
        {output.error && <ErrorText role="alert">{output.error}</ErrorText>}
        <Columns>
            <Field>Eingabe<Textarea spellCheck={false} value={input} onChange={(event) => { setInput(event.target.value); clearOutput(); }} /></Field>
            <div><Field>Ausgabe<Textarea spellCheck={false} readOnly value={output.value} /></Field><Actions><CopyButton text={output.value} /></Actions></div>
        </Columns>
    </Card>;
}

function UnitConverter() {
    const [group, setGroup] = useState<UnitGroup>('length');
    const [from, setFrom] = useState('m');
    const [to, setTo] = useState('km');
    const [input, setInput] = useState('1');
    const units = unitGroups[group].units;
    const output = input.trim() ? outcome(() => String(Number(convertUnit(input, group, from, to).toPrecision(14)))) : { value: '', error: '' };
    return <Card>
        <h2>Einheiten umrechnen</h2>
        <FormGrid>
            <Field>Größe<Select value={group} onChange={(event) => {
                const next = event.target.value as UnitGroup; setGroup(next); setFrom(unitGroups[next].units[0].id); setTo(unitGroups[next].units[1].id);
            }}>{(Object.keys(unitGroups) as UnitGroup[]).map((key) => <option key={key} value={key}>{unitGroups[key].name}</option>)}</Select></Field>
            <Field>Wert<Input inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Zum Beispiel 1,5" /></Field>
            <Field>Von<Select value={from} onChange={(event) => setFrom(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field>
            <Field>Nach<Select value={to} onChange={(event) => setTo(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field>
        </FormGrid>
        <Actions><SecondaryButton onClick={() => { setFrom(to); setTo(from); }}>Einheiten tauschen</SecondaryButton><CopyButton text={output.value} /></Actions>
        {output.error && <ErrorText role="alert">{output.error}</ErrorText>}
        <div aria-live="polite">{output.value && <Result>{output.value} {to}</Result>}</div>
        <Muted>Dezimalpunkt und Dezimalkomma sind erlaubt, Tausendertrennzeichen nicht. Datenmengen: kB/MB/GB verwenden 1.000, KiB/MiB/GiB verwenden 1.024. Ergebnisse werden auf 14 signifikante Stellen gerundet.</Muted>
    </Card>;
}

function BaseConverter() {
    const [input, setInput] = useState('255');
    const [from, setFrom] = useState(10);
    const [to, setTo] = useState(16);
    const output = input.trim() ? outcome(() => convertBase(input, from, to)) : { value: '', error: '' };
    const systems = [{ base: 2, name: 'Binär (2)' }, { base: 8, name: 'Oktal (8)' }, { base: 10, name: 'Dezimal (10)' }, { base: 16, name: 'Hexadezimal (16)' }];
    return <Card>
        <h2>Zahlensysteme</h2>
        <Field>Ganze Zahl<Input value={input} maxLength={4096} spellCheck={false} onChange={(event) => setInput(event.target.value)} /></Field>
        <FormGrid style={{ marginTop: 16 }}>
            <Field>Von<Select value={from} onChange={(event) => setFrom(Number(event.target.value))}>{systems.map((system) => <option key={system.base} value={system.base}>{system.name}</option>)}</Select></Field>
            <Field>Nach<Select value={to} onChange={(event) => setTo(Number(event.target.value))}>{systems.map((system) => <option key={system.base} value={system.base}>{system.name}</option>)}</Select></Field>
        </FormGrid>
        {output.error && <ErrorText role="alert">{output.error}</ErrorText>}
        <div aria-live="polite">{output.value && <Result>{output.value}</Result>}</div>
        <Actions><CopyButton text={output.value} /></Actions>
        <Muted>Auch große ganze Zahlen werden exakt umgerechnet. Ohne Präfixe wie 0x oder 0b eingeben; ein Vorzeichen ist erlaubt.</Muted>
    </Card>;
}

export default function Converter() {
    return <><TextConverter /><UnitConverter /><BaseConverter /></>;
}
