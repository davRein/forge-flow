import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { GlobalSettingsContext } from '../../../hooks/globalSettingsContext';
import type { GlobalSettingsStore } from '../../../services/settings/globalSettings';
import { useAuth } from '../../../hooks/authContext';
import { apiEnabled } from '../../../services/api/runtime';
import { useTranslation } from '../../../hooks/languageContext';
import { useUnsavedChanges } from '../../../hooks/navigationGuard';
import { ErrorText, FormActions, FormCard, Input, PrimaryButton, SecondaryButton } from '../../../components/ui/formStyles';

const Section = styled(FormCard)`
    max-width: 850px; h3 { margin: 0 0 10px; } p { line-height: 1.6; color: ${({ theme }) => theme.colors.textSecondary}; }
    ol { padding: 0; margin: 20px 0; list-style: none; display: grid; gap: 10px; }
    li { display: flex; gap: 10px; align-items: center; } input { flex: 1; min-width: 0; } .saved { color: ${({ theme }) => theme.colors.success}; }
`;
function Editor({ store }: { store: GlobalSettingsStore }) {
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const auth = useAuth(); const { t } = useTranslation(); const canEdit = auth.user?.administrator ?? !apiEnabled;
    const [draft, setDraft] = useState<string[]>([]); const [saved, setSaved] = useState(false);
    useEffect(() => { if (state.data) setDraft([...state.data.industries]); }, [state.data]);
    const busy = state.status === 'loading' || state.status === 'saving' || auth.busy;
    const dirty = !!state.data && JSON.stringify(draft) !== JSON.stringify(state.data.industries);
    useUnsavedChanges(dirty, () => { setDraft([...(state.data?.industries ?? [])]); setSaved(false); }, state.status === 'saving');
    const change = (values: string[]) => { setDraft(values); setSaved(false); };
    return <Section>
        <h3>{t('Kundenbranchen')}</h3><p>{t('Diese Auswahlliste gilt für alle Nutzer der Anwendung. Änderungen an der Liste verändern keine gespeicherten Kunden.')}</p>
        {!canEdit && <p>{t('Nur Administratoren können diese Liste bearbeiten.')}</p>}
        {state.status === 'loading' && <p role="status">{t('Branchen werden geladen …')}</p>}
        {state.error && <ErrorText role="alert">{t(state.error)}</ErrorText>}
        {state.data && <><ol aria-label={t('Branchen')}>
            {draft.map((name, index) => <li key={index}><Input aria-label={`${t('Branche')} ${index + 1}`} value={name} maxLength={100} readOnly={!canEdit} disabled={busy}
                onChange={event => change(draft.map((value, position) => position === index ? event.target.value : value))} />
                {canEdit && <SecondaryButton type="button" disabled={busy || draft.length <= 1} aria-label={`${t('Branche entfernen')} ${index + 1}`} onClick={() => change(draft.filter((_, position) => position !== index))}>{t('Entfernen')}</SecondaryButton>}</li>)}
        </ol>{canEdit && <SecondaryButton type="button" disabled={busy || draft.length >= 100} onClick={() => change([...draft, ''])}>{t('Branche hinzufügen')}</SecondaryButton>}</>}
        <FormActions><SecondaryButton type="button" disabled={busy} onClick={() => { setSaved(false); void store.load(); }}>{t(dirty ? 'Neu laden und Entwurf verwerfen' : 'Erneut laden')}</SecondaryButton>
            {canEdit && <PrimaryButton type="button" disabled={busy || !dirty} onClick={() => void store.save(draft).then(success => setSaved(success))}>{t('Branchenliste speichern')}</PrimaryButton>}</FormActions>
        {saved && <p className="saved" role="status">{t('✓ Branchenliste gespeichert.')}</p>}
    </Section>;
}
export default function GlobalIndustrySettings() {
    const store = useContext(GlobalSettingsContext); return store ? <Editor store={store} /> : null;
}
