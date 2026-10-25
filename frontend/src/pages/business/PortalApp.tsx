import { useEffect, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { themes } from '../../styles/theme';
import GlobalStyle from '../../styles/global';
import LanguageProvider from '../../components/LanguageProvider';
import { getBrowserLanguage, rememberBrowserLanguage } from '../../services/i18n/browserLanguage';
import { useTranslation } from '../../hooks/languageContext';
import { useAuth } from '../../hooks/authContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import NavigationGuardProvider from '../../components/navigation/NavigationGuardProvider';
import { apiClient } from '../../services/api/runtime';
import BrandMark from '../../components/layout/BrandMark';
import { Page, Panel } from './businessStyles';
import { Field, Input, Select, PrimaryButton, SecondaryButton, FormActions } from '../../components/ui/formStyles';
import ArticleContent from '../wiki/components/ArticleContent';
import { downloadBusiness } from '../../services/business/download';
import { documentStatusLabel } from './businessLogic';
type PortalHome = { customerName: string; projects: { id: number; name: string; deadline: string; tasks: number; done: number }[]; articles: { id: number; title: string; content: string }[];
    files: { id: number; name: string; size: number }[]; documents: { id: string; title: string; number: string; kind: string; status: string }[]; reportMonths: string[] };
function Content() {
    const auth = useAuth(); const { t, language } = useTranslation(); const [data, setData] = useState<PortalHome | null>(null), [error, setError] = useState<string | null>(null), [password, setPassword] = useState(''), [next, setNext] = useState('');
    const guard = useNavigationGuard(); useUnsavedChanges(!!password || !!next, () => { setPassword(''); setNext(''); }, auth.busy);
    useEffect(() => { const controller = new AbortController(); void apiClient.request<PortalHome>('/portal/home', { signal: controller.signal }).then(setData).catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Laden fehlgeschlagen'); }); return () => controller.abort(); }, []);
    const download = (path: string, name: string) => { void downloadBusiness(`${path}${path.includes('?') ? '&' : '?'}language=${language}`, name).catch(value => setError(value instanceof Error ? value.message : 'Laden fehlgeschlagen')); };
    return <Page><div className="toolbar"><div className="actions"><BrandMark /><strong>ForgeFlow · {t('Kundenportal')}</strong></div><SecondaryButton onClick={() => guard.request(() => void auth.logout())}>{t('Abmelden')}</SecondaryButton></div>
        <h1>{data?.customerName || auth.user?.name}</h1>{error && <p role="alert">{t(error)}</p>}{!data && !error && <p role="status">{t('Daten werden geladen …')}</p>}
        {data && <><h2>{t('Freigegebene Projekte')}</h2><div className="grid">{data.projects.map(project => <Panel key={project.id}><h3>{project.name}</h3><p>{t('Deadline')}: {project.deadline}</p><progress aria-label={t('Fortschritt')} value={project.done} max={Math.max(1, project.tasks)} /><p>{project.done} / {project.tasks} {t('Aufgaben abgeschlossen')}</p></Panel>)}</div>
            <h2>{t('Dokumentation')}</h2>{data.articles.map(article => <Panel key={article.id}><h3>{article.title}</h3><ArticleContent content={article.content} /></Panel>)}
            <h2>{t('Dateien')}</h2>{data.files.map(file => <Panel key={file.id}><SecondaryButton onClick={() => download(`/portal/files/${file.id}`, file.name)}>{file.name}</SecondaryButton><span className="muted"> · {file.size} B</span></Panel>)}
            <h2>{t('Angebote & Rechnungen')}</h2>{data.documents.map(document => <Panel key={document.id}><h3>{document.number} · {document.title}</h3><p>{t(documentStatusLabel(document.status))}</p><SecondaryButton onClick={() => download(`/portal/documents/${document.id}/pdf`, `${document.number}.pdf`)}>{t('PDF herunterladen')}</SecondaryButton></Panel>)}
            <h2>{t('Leistungsnachweise')}</h2>{data.reportMonths.map(month => <SecondaryButton key={month} onClick={() => download(`/portal/timesheet/pdf?month=${month}`, `timesheet-${month}.pdf`)}>{month} · PDF</SecondaryButton>)}
            {!data.projects.length && !data.articles.length && !data.files.length && !data.documents.length && !data.reportMonths.length && <Panel>{t('Für dieses Konto sind noch keine Inhalte freigegeben.')}</Panel>}
        </>}
        <Panel style={{ marginTop: 24 }}><details><summary>{t('Passwort ändern')}</summary><form onSubmit={event => { event.preventDefault(); void auth.changePassword(password, next); }}><Field>{t('Aktuelles Passwort')}<Input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field><Field>{t('Neues Passwort')}<Input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={next} onChange={event => setNext(event.target.value)} /></Field>{auth.error && <p role="alert">{t(auth.error)}</p>}<FormActions><PrimaryButton disabled={auth.busy}>{t('Passwort ändern')}</PrimaryButton></FormActions></form></details></Panel>
    </Page>;
}
export default function PortalApp() {
    const [language, setLanguage] = useState(getBrowserLanguage);
    return <ThemeProvider theme={themes.dark}><GlobalStyle /><LanguageProvider language={language}><div style={{ padding: '12px 28px', textAlign: 'right' }}><Select aria-label="Language" value={language} onChange={event => { const next = event.target.value === 'de' ? 'de' : 'en'; setLanguage(next); rememberBrowserLanguage(next); }}><option value="en">English</option><option value="de">Deutsch</option></Select></div><NavigationGuardProvider><Content /></NavigationGuardProvider></LanguageProvider></ThemeProvider>;
}
