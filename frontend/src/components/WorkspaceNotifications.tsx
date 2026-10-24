import { useCallback, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { useWorkspacePersistence } from '../hooks/workspaceContext';
import { useTranslation } from '../hooks/languageContext';
import { SaveToast } from './ui/SaveToast';
import { SecondaryButton } from './ui/formStyles';

const Viewport = styled.div`
    position: fixed;
    right: 96px;
    bottom: 24px;
    z-index: 1200;
    width: min(420px, calc(100vw - 120px));
    pointer-events: none;
    @media (max-width: 560px) {
        right: 78px;
        bottom: max(12px, env(safe-area-inset-bottom));
        width: calc(100vw - 90px);
    }
`;
const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    button { font-size: 12px; padding: 7px 10px; }
`;

function SaveErrorActions() {
    const store = useWorkspacePersistence();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const { t } = useTranslation();
    const [confirmReload, setConfirmReload] = useState(false);
    return <>
        <p>{t(state.error ?? 'Änderungen konnten nicht gespeichert werden.')}</p>
        <p>{t('Deine Änderungen bleiben bis zum Neuladen in dieser Ansicht erhalten.')}</p>
        {confirmReload ? <>
            <p>{t('Ungespeicherte Änderungen und offene Entwürfe verwerfen und den Serverstand laden?')}</p>
            <Actions>
                <SecondaryButton type="button" onClick={() => void store.load()}>{t('Verwerfen und laden')}</SecondaryButton>
                <SecondaryButton type="button" onClick={() => setConfirmReload(false)}>{t('Abbrechen')}</SecondaryButton>
            </Actions>
        </> : <Actions>
            {!state.conflict && <SecondaryButton type="button" onClick={store.retry}>{t('Speichern wiederholen')}</SecondaryButton>}
            <SecondaryButton type="button" onClick={() => setConfirmReload(true)}>{t('Serverstand laden')}</SecondaryButton>
        </Actions>}
    </>;
}

export default function WorkspaceNotifications() {
    const store = useWorkspacePersistence();
    const { saveNotice } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const { t, language } = useTranslation();
    const noticeId = saveNotice?.id;
    const dismiss = useCallback(() => {
        if (noticeId !== undefined) store.dismissSaveNotice(noticeId);
    }, [store, noticeId]);
    if (store.persistence !== 'account') return null;

    // Keep live regions mounted so screen readers announce newly inserted notices.
    return <Viewport lang={language}>
        <div role="status" aria-live="polite" aria-atomic="true">
            {saveNotice?.kind === 'success' && <SaveToast key={saveNotice.id} kind="success" title={t('Änderungen gespeichert.')} onDismiss={dismiss} />}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true">
            {saveNotice?.kind === 'error' && <SaveToast key={saveNotice.id} kind="error" title={t('Speichern fehlgeschlagen')}>
                <SaveErrorActions />
            </SaveToast>}
        </div>
    </Viewport>;
}
