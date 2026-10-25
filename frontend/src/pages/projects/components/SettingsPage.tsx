import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import { GuardedLink } from '../../../components/navigation/GuardedLink';
import GeneralSettings from './GeneralSettings';
import type { GeneralSettingsProps } from './GeneralSettings';
import AccountSettings from './AccountSettings';
import GlobalIndustrySettings from './GlobalIndustrySettings';
import { useSettingsText } from '../../../hooks/languageContext';
import { ErrorText, FormCard, SecondaryButton } from '../../../components/ui/formStyles';

const Layout = styled.div`
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    @media (max-width: 900px) { grid-template-columns: minmax(0, 1fr); gap: 24px; }
`;
const Navigation = styled.nav`
    position: sticky;
    top: 0;
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.header};
    @media (max-width: 900px) { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 560px) { grid-template-columns: minmax(0, 1fr); }
`;
const NavigationItem = styled(GuardedLink)`
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 12px;
    border-radius: 6px;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    &[aria-current='page'] {
        background: ${({ theme }) => theme.colors.primarySubtle};
        color: ${({ theme }) => theme.colors.primary};
        font-weight: 650;
    }
    &:hover:not([aria-current='page']) { background: ${({ theme }) => theme.colors.surfaceHover}; color: ${({ theme }) => theme.colors.text}; }
    svg { flex-shrink: 0; }
`;
const Content = styled.div`
    min-width: 0;
    > header { margin-bottom: 24px; }
    > header h2 { margin-bottom: 6px; font-size: 20px; }
    > header p { color: ${({ theme }) => theme.colors.textSecondary}; line-height: 1.6; }
`;

const categories = [
    { key: 'users', label: 'Nutzerverwaltung', description: 'Dein Profil, Sicherheit und die Benutzerkonten deiner Anwendung.', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
    { key: 'appearance', label: 'Optik', description: 'Gestalte die Oberfläche so, wie du am liebsten arbeitest.', icon: 'M12 3a9 9 0 1 0 9 9 3 3 0 0 0-3-3h-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2ZM7.5 8h.01M6 13h.01M9 17h.01M13 17h.01' },
    { key: 'projects', label: 'Projektmanager', description: 'Lege deine Startansicht und die Vorgaben für neue Aufgaben fest.', icon: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v3h4v-3' },
    { key: 'language', label: 'Sprache', description: 'Wähle zwischen Deutsch und Englisch.', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z' }
] as const;

const globalCategory = { key: 'global', label: 'Globale Einstellungen', description: 'Verwalte gemeinsame Auswahllisten für alle Nutzer der Anwendung.', icon: 'M12 3v18M3 12h18M5 5l14 14M5 19L19 5' } as const;
const allCategories = [...categories, globalCategory];

export default function SettingsPage(props: GeneralSettingsProps) {
    const t = useSettingsText();
    const [params] = useSearchParams();
    const category = allCategories.find((entry) => entry.key === params.get('category')) ?? categories[1];

    return <Layout lang={props.settings.language}>
        <Navigation aria-label={t('Einstellungsbereiche')}>
            {allCategories.map((entry) => {
                const search = new URLSearchParams(params);
                search.set('category', entry.key);
                return <NavigationItem key={entry.key} to={{ search: `?${search}` }} aria-current={category.key === entry.key ? 'page' : undefined}>
                    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={entry.icon} /></svg>
                    <span>{t(entry.label)}</span>
                </NavigationItem>;
            })}
        </Navigation>
        <Content>
            <header><h2>{t(category.label)}</h2><p>{t(category.description)}</p></header>
            <p role="status" aria-live="polite" style={{ marginBottom: 16 }}>
                {props.status === 'saving' ? t('Änderungen werden übernommen …') : props.status === 'ready' ? t('Einstellungen sind aktuell.') : ''}
            </p>
            {props.error && <FormCard>
                <ErrorText role="alert">{t(props.error.message)}</ErrorText>
                <SecondaryButton type="button" onClick={props.onRetry}>{t('Erneut speichern')}</SecondaryButton>
            </FormCard>}
            {/* Keep account drafts mounted when switching settings categories. */}
            <div hidden={category.key !== 'users'}>
                <AccountSettings unsavedSettings={props.status === 'saving' || !!props.error} />
            </div>
            <div hidden={category.key !== 'global'}><GlobalIndustrySettings /></div>
            {category.key !== 'users' && category.key !== 'global' && <GeneralSettings {...props} section={category.key} />}
        </Content>
    </Layout>;
}
