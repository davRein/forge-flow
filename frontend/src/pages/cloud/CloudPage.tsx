import styled from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';
import { surface } from '../../styles/primitives';
import { nextcloudUrl } from './cloudConfig';

const Page = styled.div`
    max-width: 960px; margin: 0 auto; padding: 28px;
    h1 { font-size: 24px; margin: 0 0 8px; }
    p { line-height: 1.65; color: ${({ theme }) => theme.colors.textSecondary}; }
    @media (max-width: 700px) { padding: 20px 16px; }
`;
const Card = styled.section`
    ${surface} padding: 24px; margin-top: 22px;
    h2 { font-size: 18px; margin: 0 0 12px; }
    small { display: block; margin-top: 14px; overflow-wrap: anywhere; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const OpenLink = styled.a`
    display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 6px;
    background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 13px;
    font-weight: 600; text-decoration: none;
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 4px; }
`;

export default function CloudPage() {
    const { t, language } = useTranslation();
    const url = nextcloudUrl(import.meta.env.VITE_NEXTCLOUD_URL);
    return <Page lang={language}><h1>{t('Cloud')}</h1><p>{t('Dateien zentral ablegen, Ordner teilen und gemeinsam organisieren.')}</p>
        <Card><h2>Nextcloud</h2><p>{t('Dein gemeinsamer Dateibereich mit Uploads, Freigaben und Versionsverlauf.')}</p>
            {url ? <><OpenLink href={url} target="_blank" rel="noopener noreferrer">{t('Nextcloud öffnen')}<span aria-hidden="true">↗</span></OpenLink><small>{url} · {t('Öffnet in einem neuen Tab')}</small></>
                : <p role="alert">{t('Der Cloud-Zugang ist noch nicht konfiguriert. Bitte die Administration kontaktieren.')}</p>}
            <p>{t('Melde dich mit deinem Nextcloud-Konto an. ForgeFlow- und Portal-Konten werden nicht automatisch übertragen.')}</p>
        </Card>
    </Page>;
}
