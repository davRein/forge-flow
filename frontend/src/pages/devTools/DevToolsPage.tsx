import { useTranslation } from '../../hooks/languageContext';
import Calculator from './components/Calculator';
import Converter from './components/Converter';
import JsonFormatter from './components/JsonFormatter';
import SnippetWorkbench from './components/SnippetWorkbench';
import { Muted, Page } from './styles/toolStyles';

const titles: Record<string, string> = { json: 'JSON Formatter', calculator: 'Rechner', converter: 'Konverter', snippeter: 'Snippeter', dbScripter: 'DB Scripter' };

export default function DevToolsPage({ section = 'json', active = true }: { section?: string; active?: boolean }) {
    const { t, language } = useTranslation();
    return <Page lang={language}>
        <h1>{t(titles[section] ?? titles.json)}</h1>
        {!['snippeter', 'dbScripter'].includes(section) && <Muted>{t('Eingaben und Ergebnisse bleiben beim Ansichts- und Modulwechsel erhalten. Beim Neuladen werden sie zurückgesetzt.')}</Muted>}
        <div hidden={section !== 'json'}><JsonFormatter /></div>
        <div hidden={section !== 'calculator'}><Calculator /></div>
        <div hidden={section !== 'converter'}><Converter /></div>
        <div hidden={section !== 'snippeter'}><SnippetWorkbench active={active && section === 'snippeter'} /></div>
        <div hidden={section !== 'dbScripter'}><SnippetWorkbench sql active={active && section === 'dbScripter'} /></div>
    </Page>;
}
