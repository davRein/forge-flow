import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { modules } from '../../../config/moduleConfig';
import { useAuth } from '../../../hooks/authContext';
import { GlobalSettingsContext } from '../../../hooks/globalSettingsContext';
import type { GlobalAppKey } from '../../../services/settings/globalSettings';
import { apiEnabled } from '../../../services/api/runtime';
import { useTranslation } from '../../../hooks/languageContext';
import { useUnsavedChanges } from '../../../hooks/navigationGuard';
import { ErrorText, FormActions, FormCard, PrimaryButton, SecondaryButton } from '../../../components/ui/formStyles';
import ModuleIcon from '../../../components/layout/ModuleIcon';
import type { ModuleKey } from '../../../config/moduleConfig';

const Section = styled(FormCard)`
    max-width: 850px;
    h3 { margin: 0 0 10px; }
    p { line-height: 1.6; color: ${({ theme }) => theme.colors.textSecondary}; }
    .apps { display: grid; gap: 8px; margin: 20px 0; }
    label { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 8px 12px; border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 8px; }
    input { accent-color: ${({ theme }) => theme.colors.primary}; }
`;

type AppOption = (typeof modules)[number] & { key: GlobalAppKey };
const options = modules.filter((module): module is AppOption => module.key !== 'settings');
const emptyApps: GlobalAppKey[] = [];
const subscribeNothing = () => () => {};
const emptySnapshot = () => null;

export default function GlobalAppSettings({ kind }: { kind: 'apps' | 'ai' }) {
    const store = useContext(GlobalSettingsContext);
    const state = useSyncExternalStore(store?.subscribe ?? subscribeNothing, store?.getSnapshot ?? emptySnapshot, store?.getSnapshot ?? emptySnapshot);
    const auth = useAuth();
    const { t } = useTranslation();
    const canEdit = auth.user?.administrator ?? !apiEnabled;
    const field = kind === 'apps' ? 'visibleApps' : 'aiApps';
    const savedApps = state?.data?.[field] ?? emptyApps;
    const [draft, setDraft] = useState<GlobalAppKey[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => { setDraft([...savedApps]); }, [savedApps]);

    const busy = !state || state.status === 'loading' || state.status === 'saving' || auth.busy;
    const dirty = !!state?.data && JSON.stringify(draft) !== JSON.stringify(savedApps);
    useUnsavedChanges(dirty, () => { setDraft([...savedApps]); setSaved(false); }, state?.status === 'saving');

    const title = kind === 'apps' ? 'Anwendungen in der Navigation' : 'KI-Assistent in Anwendungen';
    const description = kind === 'apps'
        ? 'Wähle aus, welche Anwendungen für alle Nutzer in der linken Navigation erscheinen.'
        : 'Wähle aus, in welchen Anwendungen der KI-Button rechts unten angezeigt wird.';

    return <Section>
        <h3>{t(title)}</h3>
        <p>{t(description)}</p>
        {kind === 'ai' && <p>{t('Im Projektmanager kann die KI Projektmanagementdaten lesen und Änderungen vorschlagen. In anderen Anwendungen hat sie keinen Datenzugriff und keine Werkzeuge.')}</p>}
        {!canEdit && <p>{t('Nur Administratoren können diese Auswahl bearbeiten.')}</p>}
        {state?.status === 'loading' && <p role="status">{t('Globale Auswahl wird geladen …')}</p>}
        {!state?.data && state?.error && <ErrorText role="alert">{t(state.error)}</ErrorText>}
        {state?.data && <div className="apps" role="group" aria-label={t(title)}>
            {options.map(module => {
                const appKey = module.key as Exclude<ModuleKey, 'settings'>;
                const checked = draft.includes(appKey);
                return <label key={module.key}>
                    <input type="checkbox" checked={checked} disabled={!canEdit || busy || (kind === 'apps' && checked && draft.length === 1)}
                        onChange={event => {
                            setSaved(false);
                            setDraft(current => event.target.checked
                                ? [...current, appKey]
                                : current.filter(value => value !== appKey));
                        }} />
                    <ModuleIcon moduleKey={module.key} />
                    <span>{t(module.label)}</span>
                </label>;
            })}
        </div>}
        {state?.error && state.data && <ErrorText role="alert">{t(state.error)}</ErrorText>}
        <FormActions>
            <SecondaryButton type="button" disabled={busy || !state?.data} onClick={() => { setSaved(false); void store?.load(); }}>
                {t(dirty ? 'Neu laden und Entwurf verwerfen' : 'Erneut laden')}
            </SecondaryButton>
            {canEdit && <PrimaryButton type="button" disabled={busy || !dirty} onClick={() => {
                if (!store) return;
                void store.save(kind === 'apps' ? { visibleApps: draft } : { aiApps: draft }).then(success => setSaved(success));
            }}>{t('Auswahl speichern')}</PrimaryButton>}
        </FormActions>
        {saved && <p role="status">{t('✓ Auswahl gespeichert.')}</p>}
    </Section>;
}
