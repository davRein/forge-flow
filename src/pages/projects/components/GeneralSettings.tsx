import styled from 'styled-components';
import type { AppSettings, ThemeMode } from '../../../types/settings.types';
import { defaultSettings } from '../../../config/appSettings';
import { themes } from '../../../styles/theme';
import { ErrorText, Field, FormActions, FormCard, SecondaryButton, Select } from '../styles/projectStyles';
import type { SettingsError, SettingsRepository, SettingsStatus } from '../../../services/settings/settingsRepository';

const Section = styled(FormCard)`
    max-width: 850px;
    h2 { margin-bottom: 12px; font-size: 20px; }
    p { line-height: 1.6; }
`;
const Hint = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 12px;
    line-height: 1.6;
`;
const ThemeChoices = styled.fieldset`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    border: 0;
    margin-top: 20px;
    legend { margin-bottom: 12px; }
`;
const ThemeChoice = styled.label<{ $selected: boolean }>`
    display: flex;
    flex: 1;
    min-width: 180px;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 2px solid ${({ theme, $selected }) => $selected ? theme.colors.primary : theme.colors.border};
    border-radius: 10px;
    cursor: pointer;
    input { accent-color: ${({ theme }) => theme.colors.primary}; }
`;
const Swatch = styled.span<{ $mode: ThemeMode }>`
    display: grid;
    place-items: center;
    width: 54px;
    height: 44px;
    border-radius: 6px;
    background: ${({ $mode }) => themes[$mode].colors.content};
    color: ${({ $mode }) => themes[$mode].colors.text};
    border: 1px solid ${({ $mode }) => themes[$mode].colors.border};
    font-weight: 700;
`;

type Props = {
    settings: AppSettings;
    onChange: (settings: AppSettings) => void;
    onReset: () => void;
    status: SettingsStatus;
    error: SettingsError | null;
    persistence: SettingsRepository['persistence'];
    onRetry: () => void;
};

export default function GeneralSettings({ settings, onChange, onReset, status, error, persistence, onRetry }: Props) {
    const isDefault = settings.themeMode === defaultSettings.themeMode
        && settings.defaultProjectView === defaultSettings.defaultProjectView
        && settings.defaultTaskPriority === defaultSettings.defaultTaskPriority;

    function change(next: AppSettings) {
        onChange(next);
    }

    return (
        <section aria-label="Allgemeine Einstellungen">
            <p role="status" aria-live="polite" style={{ marginBottom: 16 }}>
                {status === 'saving' ? 'Änderungen werden übernommen …' : status === 'ready' ? 'Einstellungen sind aktuell.' : ''}
            </p>
            {error && <Section>
                <ErrorText role="alert">{error.message}</ErrorText>
                <SecondaryButton onClick={onRetry}>Erneut speichern</SecondaryButton>
            </Section>}
            <Section>
                <h2>Darstellung</h2>
                <p>Wähle das Design für die gesamte Anwendung.</p>
                <ThemeChoices>
                    <legend>Farbschema</legend>
                    {(['dark', 'light'] as const).map((mode) => (
                        <ThemeChoice key={mode} $selected={settings.themeMode === mode}>
                            <input type="radio" name="theme-mode" value={mode} checked={settings.themeMode === mode}
                                onChange={() => change({ ...settings, themeMode: mode })} />
                            <Swatch $mode={mode} aria-hidden="true">Aa</Swatch>
                            <span>{mode === 'dark' ? 'Dunkel' : 'Hell'}</span>
                        </ThemeChoice>
                    ))}
                </ThemeChoices>
            </Section>
            <Section>
                <h2>Startansicht</h2>
                <Field>
                    Standardansicht im Project Manager
                    <Select value={settings.defaultProjectView} onChange={(event) => change({ ...settings, defaultProjectView: event.target.value as AppSettings['defaultProjectView'] })}>
                        <option value="dashboard">Projekt Dashboard</option>
                        <option value="projects">Projektliste</option>
                    </Select>
                </Field>
                <Hint>Diese Ansicht öffnet sich, wenn du in der Seitenleiste den Project Manager auswählst.</Hint>
            </Section>
            <Section>
                <h2>Aufgaben</h2>
                <Field>
                    Standardpriorität für neue Aufgaben
                    <Select value={settings.defaultTaskPriority} onChange={(event) => change({ ...settings, defaultTaskPriority: event.target.value as AppSettings['defaultTaskPriority'] })}>
                        <option value="low">Niedrig</option>
                        <option value="medium">Mittel</option>
                        <option value="high">Hoch</option>
                    </Select>
                </Field>
                <Hint>Die Auswahl wird beim Öffnen eines neuen Aufgabenformulars vorbelegt.</Hint>
            </Section>
            <Section>
                <h2>Standardeinstellungen</h2>
                <p>Dunkles Design, Projekt Dashboard und mittlere Aufgabenpriorität.</p>
                <FormActions>
                    <SecondaryButton disabled={isDefault} onClick={onReset}>Einstellungen zurücksetzen</SecondaryButton>
                </FormActions>
                <Hint>{persistence === 'session'
                    ? 'Änderungen gelten sofort und sind bis zum Neuladen in dieser Sitzung gespeichert.'
                    : 'Änderungen gelten sofort und werden für dein Benutzerkonto gespeichert.'}</Hint>
            </Section>
        </section>
    );
}
