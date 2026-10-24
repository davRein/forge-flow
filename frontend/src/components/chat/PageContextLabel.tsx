import { useTranslation } from '../../hooks/languageContext';
import { chatPages, chatProjectTabs } from '../../services/ai/pageContext';
import type { ChatPageContext } from '../../services/ai/pageContext';

export default function PageContextLabel({ page }: { page: ChatPageContext | null | undefined }) {
    const { t } = useTranslation();
    if (!page) return null;
    return <small className="page-reference">{t('Seitenbezug')}: {t(chatPages[page.route])}
        {page.projectId != null && <> · {t('Projekt #{id}', { id: page.projectId })} · {t(chatProjectTabs[page.projectTab ?? 'overview'])}</>}
    </small>;
}
