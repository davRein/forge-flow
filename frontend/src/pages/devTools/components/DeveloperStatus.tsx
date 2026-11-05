import { useDeveloper } from '../../../hooks/developerContext';
import { useTranslation } from '../../../hooks/languageContext';
import { ErrorText, Muted, SecondaryButton } from '../styles/toolStyles';
export default function DeveloperStatus() {
    const { status, error, busy, remote, load } = useDeveloper(); const { t } = useTranslation();
    return <>
        {!remote && <Muted>{t('Lokaler Modus: gespeicherte Snippets gelten nur für diese Sitzung. KI, Datenbanken und GitHub benötigen das Backend.')}</Muted>}
        {status === 'loading' && <p role="status">{t('Entwicklerdaten werden geladen …')}</p>}
        {error && <ErrorText role="alert">{t(error)}</ErrorText>}
        {status === 'error' && <SecondaryButton disabled={busy} onClick={() => void load()}>{t('Erneut versuchen')}</SecondaryButton>}
    </>;
}
