import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';
import type { NavigationAction } from '../../services/ai/navigationActions';
import { Action } from './chatStyles';

const Card = styled.section`
    padding: 14px; margin-top: 12px; border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px; background: ${({ theme }) => theme.colors.header};
    h4 { font-size: 13px; margin: 0 0 8px; } p { font-size: 12px; margin: 7px 0; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .success { color: ${({ theme }) => theme.colors.success}; }
    small { display: block; line-height: 1.5; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const views = { overview: 'Projektübersicht', tasks: 'Aufgabenliste', board: 'Kanban' };
const statuses = {
    proposed: 'Wartet auf deine Bestätigung', approved: 'Freigegeben. Ausführung noch nicht bestätigt.',
    rejected: 'Vorschlag abgelehnt', succeeded: 'Ansicht erfolgreich geöffnet', failed: 'Ansicht konnte nicht geöffnet werden', expired: 'Vorschlag abgelaufen'
};
const reasons = {
    NAVIGATION_UNAVAILABLE: 'Die Navigation ist derzeit nicht verfügbar. Bitte einen neuen Vorschlag anfordern.',
    UNSAVED_CHANGES: 'Bitte Formulare speichern oder schließen und ausstehende Speicherungen abwarten.',
    CLIENT_CANCELLED: 'Die Navigation wurde abgebrochen.', EXPIRED: 'Vorschlag abgelaufen'
};
export default function NavigationActionCard({ action, busy, available, blocked, error, onDecision }: {
    action: NavigationAction; busy: boolean; available: boolean; blocked: boolean; error?: string;
    onDecision: (decision: 'approve' | 'reject') => void;
}) {
    const { t, locale } = useTranslation();
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (action.status !== 'proposed') return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [action.status]);
    const expired = Date.parse(action.expiresAt) <= now;
    return <Card aria-label={t('Navigationsvorschlag')}>
        <h4>{t('Navigationsvorschlag')}</h4>
        <p>#{action.projectId} · {action.projectName}</p><p>{t(views[action.projectTab])}</p>
        <p className={action.status === 'succeeded' ? 'success' : undefined} role="status">
            {action.status === 'succeeded' && <span aria-hidden="true">✓ </span>}{t(statuses[action.status === 'proposed' && expired ? 'expired' : action.status])}
        </p>
        {action.resultCode && <p role="alert">{t(reasons[action.resultCode])}</p>}
        {error && <p role="alert">{t(error)}</p>}
        {action.status === 'proposed' && !expired && <>
            <small>{t('Gültig bis {time}', { time: new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(action.expiresAt)) })}</small>
            <small>{t('Öffnet nur die angezeigte Ansicht. Projektdaten werden nicht verändert.')}</small>
            {(blocked || !available) && <p>{t(blocked ? reasons.UNSAVED_CHANGES : reasons.NAVIGATION_UNAVAILABLE)}</p>}
            <div className="buttons">
                <Action $primary type="button" disabled={busy || blocked || !available || !!error} onClick={() => onDecision('approve')}>{t('Bestätigen und öffnen')}</Action>
                <Action type="button" disabled={busy || !!error} onClick={() => onDecision('reject')}>{t('Ablehnen')}</Action>
            </div>
        </>}
    </Card>;
}
