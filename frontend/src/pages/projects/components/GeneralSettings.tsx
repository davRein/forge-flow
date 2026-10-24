import styled from 'styled-components';
import type { AppSettings, ThemeMode } from '../../../types/settings.types';
import { defaultSettings } from '../../../config/appSettings';
import { themes } from '../../../styles/theme';
import { Field, FormActions, FormCard, SecondaryButton, Select } from '../styles/projectStyles';
import type { SettingsError, SettingsRepository, SettingsStatus } from '../../../services/settings/settingsRepository';
import { useSettingsText } from '../../../hooks/languageContext';

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

export type GeneralSettingsProps = {
    settings: AppSettings;
    onChange: (settings: AppSettings) => void;
    onReset: () => void;
    status: SettingsStatus;
    error: SettingsError | null;
    persistence: SettingsRepository['persistence'];
    onRetry: () => void;
};

type Props = GeneralSettingsProps & { section?: 'appearance' | 'projects' | 'language' };

export default function GeneralSettings({ settings, onChange, onReset, persistence, section = 'appearance' }: Props) {
    const t = useSettingsText();
    const isDefault = settings.themeMode === defaultSettings.themeMode
        && settings.defaultProjectView === defaultSettings.defaultProjectView
        && settings.defaultTaskPriority === defaultSettings.defaultTaskPriority
        && settings.language === defaultSettings.language;

    function change(next: AppSettings) {
        onChange(next);
    }

    return (
        <section aria-label={t('Allgemeine Einstellungen')}>
            {section === 'appearance' && <Section>
                <h2>{t('Darstellung')}</h2>
                <p>{t('Wähle das Design für die gesamte Anwendung.')}</p>
                <ThemeChoices>
                    <legend>{t('Farbschema')}</legend>
                    {(['dark', 'light'] as const).map((mode) => (
                        <ThemeChoice key={mode} $selected={settings.themeMode === mode}>
                            <input type="radio" name="theme-mode" value={mode} checked={settings.themeMode === mode}
                                onChange={() => change({ ...settings, themeMode: mode })} />
                            <Swatch $mode={mode} aria-hidden="true">Aa</Swatch>
                            <span>{mode === 'dark' ? t('Dunkel') : t('Hell')}</span>
                        </ThemeChoice>
                    ))}
                </ThemeChoices>
            </Section>}
            {section === 'projects' && <><Section>
                <h2>{t('Startansicht')}</h2>
                <Field>
                    {t('Standardansicht im Project Manager')}
                    <Select value={settings.defaultProjectView} onChange={(event) => change({ ...settings, defaultProjectView: event.target.value as AppSettings['defaultProjectView'] })}>
                        <option value="dashboard">{t('Projekt Dashboard')}</option>
                        <option value="projects">{t('Projektliste')}</option>
                    </Select>
                </Field>
                <Hint>{t('Diese Ansicht öffnet sich, wenn du in der Seitenleiste den Project Manager auswählst.')}</Hint>
            </Section>
            <Section>
                <h2>{t('Aufgaben')}</h2>
                <Field>
                    {t('Standardpriorität für neue Aufgaben')}
                    <Select value={settings.defaultTaskPriority} onChange={(event) => change({ ...settings, defaultTaskPriority: event.target.value as AppSettings['defaultTaskPriority'] })}>
                        <option value="low">{t('Niedrig')}</option>
                        <option value="medium">{t('Mittel')}</option>
                        <option value="high">{t('Hoch')}</option>
                    </Select>
                </Field>
                <Hint>{t('Die Auswahl wird beim Öffnen eines neuen Aufgabenformulars vorbelegt.')}</Hint>
            </Section></>}
            {section === 'language' && <Section>
                <h2>{t('Sprache')}</h2>
                <Field>{t('Sprache der Oberfläche')}
                    <Select value={settings.language} onChange={(event) => change({ ...settings, language: event.target.value as AppSettings['language'] })}>
                        <option value="de" lang="de">Deutsch</option>
                        <option value="en" lang="en">English</option>
                    </Select>
                </Field>
                <Hint>{t('Die Sprachwahl gilt für Einstellungen, Wiki und Dev Tools.')}</Hint>
            </Section>}
            <Section>
                <h2>{t('Standardeinstellungen')}</h2>
                <p>{t('Setzt Optik, Projektmanager und Sprache auf die Standardwerte zurück.')}</p>
                <FormActions>
                    <SecondaryButton disabled={isDefault} onClick={onReset}>{t('Alle Einstellungen zurücksetzen')}</SecondaryButton>
                </FormActions>
                <Hint>{persistence === 'session'
                    ? t('Änderungen gelten sofort und sind bis zum Neuladen in dieser Sitzung gespeichert.')
                    : t('Änderungen gelten sofort und werden für dein Benutzerkonto gespeichert.')}</Hint>
            </Section>
        </section>
    );
}
