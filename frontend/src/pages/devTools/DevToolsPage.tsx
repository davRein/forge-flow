import { useTranslation } from '../../hooks/languageContext';
import Calculator from './components/Calculator';
import Converter from './components/Converter';
import JsonFormatter from './components/JsonFormatter';
import RestClient from './components/RestClient';
import { Muted, Page } from './styles/toolStyles';

const titles: Record<string, string> = { json: 'JSON Formatter', rest: 'REST-Test', calculator: 'Rechner', converter: 'Konverter' };

export default function DevToolsPage({ section = 'json', active = true }: { section?: string; active?: boolean }) {
    const { t, language } = useTranslation();
    return <Page lang={language}>
        <h1>{t(titles[section] ?? titles.json)}</h1>
        <Muted>{t(section === 'rest' ? 'Gespeicherte Collections bleiben erhalten. Ungespeicherte Eingaben und Antworten gelten für diese Sitzung.' : 'Eingaben und Ergebnisse bleiben beim Ansichts- und Modulwechsel erhalten. Beim Neuladen werden sie zurückgesetzt.')}</Muted>
        <div hidden={section !== 'json'}><JsonFormatter /></div>
        <div hidden={section !== 'rest'}><RestClient active={active && section === 'rest'} /></div>
        <div hidden={section !== 'calculator'}><Calculator /></div>
        <div hidden={section !== 'converter'}><Converter /></div>
    </Page>;
}
