import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { useTheme } from 'styled-components';
import { showcaseProjects, suiteMessage } from '../../config/showcaseProjects';
import type { ShowcaseApp } from '../../config/showcaseProjects';
import { useTranslation } from '../../hooks/languageContext';
import { PrimaryButton } from '../../components/ui/formStyles';
import { apiEnabled } from '../../services/api/runtime';

const Page = styled.section`
    position: relative;
    height: calc(100dvh - ${({ theme }) => theme.layout.headerHeight} - 52px);
    min-height: 400px;
    iframe { display: block; width: 100%; height: 100%; border: 0; background: ${({ theme }) => theme.colors.content}; }
`;
const Notice = styled.div`
    padding: 24px;
    p { margin-bottom: 16px; }
`;

export default function ShowcasePage({ app, section, active }: { app: ShowcaseApp; section: string; active: boolean }) {
    const { t, language } = useTranslation();
    const embeddedLanguage = app === 'dataScout' || language === 'fr' ? 'en' : language;
    const theme = useTheme();
    const navigate = useNavigate();
    const project = showcaseProjects.find(value => value.key === app)!;
    const iframe = useRef<HTMLIFrameElement>(null);
    const [opened, setOpened] = useState(active);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const latest = useRef({ section, active, ready, language: embeddedLanguage, theme });
    latest.current = { section, active, ready, language: embeddedLanguage, theme };
    const send = (message: object) => {
        if (project.url) iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', ...message }, new URL(project.url).origin);
    };
    useEffect(() => { if (active) setOpened(true); }, [active]);
    useEffect(() => {
        if (!opened || !project.url) return;
        const timer = window.setTimeout(() => { if (!latest.current.ready) setFailed(true); }, 30000);
        const receive = (event: MessageEvent) => {
            if (event.source !== iframe.current?.contentWindow || event.origin !== new URL(project.url!).origin) return;
            const message = suiteMessage(event.data);
            if (!message || !(project.sections as readonly string[]).includes(message.section)) return;
            if (message.type === 'hello') {
                iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', type: 'init', language: latest.current.language, theme: latest.current.theme, authMode: apiEnabled ? 'suite' : 'demo' }, event.origin);
            } else if (message.type === 'ready') {
                setReady(true); setFailed(false); window.clearTimeout(timer);
                iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', type: 'navigate', section: latest.current.section }, event.origin);
            } else if (latest.current.active && (!window.location?.hash || window.location.hash.startsWith(`#/${app}/`))
                && message.section !== latest.current.section) {
                navigate(`/${app}/${message.section}`, { replace: true });
            }
        };
        window.addEventListener('message', receive);
        return () => { window.clearTimeout(timer); window.removeEventListener('message', receive); };
    }, [opened, project, app, attempt, navigate]);
    useEffect(() => {
        if (ready && active && project.url) iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', type: 'navigate', section }, new URL(project.url).origin);
    }, [ready, active, section, project]);
    useEffect(() => {
        if (ready && project.url) iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', type: 'language', language: embeddedLanguage }, new URL(project.url).origin);
    }, [ready, embeddedLanguage, project]);
    useEffect(() => {
        if (ready && project.url) iframe.current?.contentWindow?.postMessage({ channel: 'forgeflow-suite', type: 'theme', theme }, new URL(project.url).origin);
    }, [ready, theme, project]);
    if (!opened) return null;
    return <Page aria-label={project.label}>
        {!project.url ? <Notice role="alert">{t('App-Adresse noch nicht konfiguriert')}</Notice> : <>
            {!ready && <Notice role={failed ? 'alert' : 'status'}>
                <p>{t(failed ? 'Die App ist noch nicht erreichbar. Prüfe, ob sie gestartet ist, und versuche es erneut.' : 'App wird geladen …')}</p>
                {failed && <PrimaryButton onClick={() => { setReady(false); setFailed(false); setAttempt(value => value + 1); }}>{t('Erneut versuchen')}</PrimaryButton>}
            </Notice>}
            <iframe key={attempt} ref={iframe} src={project.url} title={project.label}
                hidden={!ready} style={!ready ? { height: 0, visibility: 'hidden' } : undefined}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups"
                referrerPolicy="strict-origin" onLoad={() => send({ type: 'init', language: embeddedLanguage, theme, authMode: apiEnabled ? 'suite' : 'demo' })} />
        </>}
    </Page>;
}
