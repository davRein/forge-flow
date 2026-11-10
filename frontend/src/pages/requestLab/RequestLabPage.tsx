import { useTranslation } from '../../hooks/languageContext';
import RestClient from './components/RestClient';
import { Muted, Page } from '../devTools/styles/toolStyles';

export default function RequestLabPage({ active = true }: { active?: boolean }) {
    const { t, language } = useTranslation();
    return <Page lang={language} aria-label="RequestLab">
        <h1>RequestLab</h1>
        <Muted>{t('Gespeicherte Collections bleiben erhalten. Ungespeicherte Eingaben und Antworten gelten für diese Sitzung.')}</Muted>
        <RestClient active={active} />
    </Page>;
}
