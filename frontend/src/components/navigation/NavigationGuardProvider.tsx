import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavigationGuard } from '../../hooks/navigationGuard';
import type { NavigationDraft } from '../../hooks/navigationGuard';
import { useTranslation } from '../../hooks/languageContext';
import Dialog from '../ui/Dialog';
import { FormActions, PrimaryButton, SecondaryButton } from '../ui/formStyles';

export default function NavigationGuardProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const drafts = useRef(new Map<string, NavigationDraft>());
    const [version, setVersion] = useState(0);
    const [destination, setDestination] = useState<{ action: () => void } | null>(null);
    const register = useCallback((id: string, draft: NavigationDraft | null) => {
        if (draft) drafts.current.set(id, draft); else if (!drafts.current.delete(id)) return;
        setVersion(value => value + 1);
    }, []);
    const request = useCallback((action: () => void) => {
        if (drafts.current.size) setDestination({ action }); else action();
    }, []);
    const value = useMemo(() => ({ request, register }), [request, register]);
    const pending = [...drafts.current.values()].some(draft => draft.pending);
    useEffect(() => {
        if (destination && drafts.current.size === 0) { setDestination(null); destination.action(); }
    }, [destination, version]);
    useEffect(() => {
        if (!drafts.current.size || typeof window === 'undefined') return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [version]);
    return <NavigationGuard.Provider value={value}>{children}
        {destination && <Dialog width={460} title={t('Ungespeicherte Änderungen')} onClose={() => setDestination(null)}>
            <p>{t(pending ? 'Änderungen werden noch gespeichert. Bitte warte, bevor du die Ansicht verlässt.' : 'Wenn du diese Ansicht verlässt, gehen ungespeicherte Änderungen verloren. Möchtest du fortfahren?')}</p>
            <FormActions>
                <SecondaryButton autoFocus type="button" onClick={() => setDestination(null)}>{t('Auf dieser Seite bleiben')}</SecondaryButton>
                <PrimaryButton type="button" disabled={pending} onClick={() => {
                    const action = destination.action;
                    for (const draft of [...drafts.current.values()]) draft.discard();
                    setDestination(null); action();
                }}>{t('Änderungen verwerfen und wechseln')}</PrimaryButton>
            </FormActions>
        </Dialog>}
    </NavigationGuard.Provider>;
}
