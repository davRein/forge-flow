import Calculator from './components/Calculator';
import Converter from './components/Converter';
import JsonFormatter from './components/JsonFormatter';
import RestClient from './components/RestClient';
import { Muted, Page } from './styles/toolStyles';

const titles: Record<string, string> = { json: 'JSON Formatter', rest: 'REST-Test', calculator: 'Rechner', converter: 'Konverter' };

export default function DevToolsPage({ section = 'json' }: { section?: string }) {
    return <Page>
        <h1>{titles[section] ?? titles.json}</h1>
        <Muted>Eingaben und Ergebnisse bleiben beim Ansichts- und Modulwechsel erhalten. Beim Neuladen werden sie zurückgesetzt.</Muted>
        <div hidden={section !== 'json'}><JsonFormatter /></div>
        <div hidden={section !== 'rest'}><RestClient /></div>
        <div hidden={section !== 'calculator'}><Calculator /></div>
        <div hidden={section !== 'converter'}><Converter /></div>
    </Page>;
}
