import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';
import type { WorkspaceMutation } from '../../services/ai/workspaceActions';
import { Action } from './chatStyles';
import { entityLabels, fieldLabels } from './workspaceLabels';

const Card = styled.section`
    border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 12px; margin-top: 12px; padding: 14px;
    background: ${({ theme }) => theme.colors.header}; font-size: 12px; line-height: 1.6;
    h4 { margin: 0 0 10px; } dl { margin: 10px 0; } dt { font-weight: 600; color: ${({ theme }) => theme.colors.textSecondary}; }
    dd { margin: 2px 0 9px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; } .success { color: ${({ theme }) => theme.colors.success};
    input { display: block; width: 100%; box-sizing: border-box; border-radius: 8px; padding: 9px; margin-top: 6px;
        background: ${({ theme }) => theme.colors.content}; color: ${({ theme }) => theme.colors.text}; border: 1px solid ${({ theme }) => theme.colors.border}; }
`;
export default function WorkspaceCreationCard({ action, busy, blocked, error, onDecision }: {
    action: WorkspaceMutation; busy: boolean; blocked: boolean; error?: string; onDecision: (decision: 'approve' | 'reject', initialPassword?: string) => void;
}) {
    const { t } = useTranslation(); const [now, setNow] = useState(Date.now);
    const [password, setPassword] = useState('');
    useEffect(() => { if (action.status !== 'proposed') return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [action.status]);
    const expired = action.status === 'expired' || Date.parse(action.expiresAt) <= now;
    const updating = action.type === 'workspace.update';
    const display = (value: unknown) => value === null ? '—' : typeof value === 'boolean' ? t(value ? 'Ja' : 'Nein') : Array.isArray(value) ? value.join(', ') || '—' : String(value) || '—';
    return <Card aria-label={t(updating ? 'Änderungsvorschlag' : 'Anlagevorschlag')}>
        <h4>{t(updating ? 'Änderungsvorschlag' : 'Anlagevorschlag')} · {t(entityLabels[action.entity])}{updating && ` #${action.data.id}`}</h4>
        <dl>{Object.entries(action.data).map(([key, value]) => <div key={key}><dt>{t(fieldLabels[key] ?? key)}</dt>
            <dd>{updating && key !== 'id' ? <><span>{t('Bisher')}: </span>{display(action.before?.[key])}<br /><span>{t('Nachher')}: </span>{display(value)}</> : display(value)}</dd></div>)}</dl>
        <p role="status" className={action.status === 'succeeded' ? 'success' : undefined}>{t(action.status === 'succeeded' ? '✓ Eintrag erfolgreich gespeichert.'
            : action.status === 'rejected' ? 'Vorschlag abgelehnt' : expired ? 'Vorschlag abgelaufen' : 'Noch nicht gespeichert. Bitte die Angaben prüfen.')}</p>
        {error && <p role="alert">{t(error)}</p>}
        {action.status === 'proposed' && !expired && <>
            {blocked && <p>{t('Bitte Formulare speichern oder schließen und ausstehende Speicherungen abwarten.')}</p>}
            {action.entity === 'users' && <label>{t('Initialpasswort')}<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={password} disabled={busy}
                onChange={event => setPassword(event.target.value)} /><p>{t('Nur direkt an das Backend, niemals an das KI-Modell. Mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes.')}</p></label>}
            <div className="buttons"><Action $primary type="button" disabled={busy || blocked || !!error || action.entity === 'users' && (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72 || password.includes('\0'))} onClick={() => { onDecision('approve', action.entity === 'users' ? password : undefined); setPassword(''); }}>{t(updating ? 'Bestätigen und ändern' : 'Bestätigen und anlegen')}</Action>
                <Action type="button" disabled={busy || !!error} onClick={() => { onDecision('reject'); setPassword(''); }}>{t('Ablehnen')}</Action></div>
        </>}
    </Card>;
}
