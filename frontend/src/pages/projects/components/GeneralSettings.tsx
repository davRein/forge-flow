import styled from 'styled-components';
import type { AppSettings, ThemeMode } from '../../../types/settings.types';
import { defaultSettings } from '../../../config/appSettings';
import { themes, themeOptions } from '../../../styles/theme';
import { Field, FormActions, FormCard, SecondaryButton, Select } from '../styles/projectStyles';
import type { SettingsError, SettingsRepository, SettingsStatus } from '../../../services/settings/settingsRepository';
import { useSettingsText } from '../../../hooks/languageContext';

const Section = styled(FormCard)`
    max-width: 640px;
    padding: 20px;
    h2 { margin-bottom: 8px; font-size: 16px; }
    p { line-height: 1.5; font-size: 13px; }
`;
const Hint = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 12px;
    line-height: 1.6;
`;
const ThemeChoices = styled.fieldset`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 520px;
    gap: 8px;
    border: 0;
    margin: 16px 0 0;
    padding: 0;
    min-width: 0;
    legend { margin-bottom: 8px; font-size: 12px; color: ${({ theme }) => theme.colors.textSecondary}; }
    @media (max-width: 580px) { grid-template-columns: minmax(0, 1fr); }
`;
const ThemeChoice = styled.label<{ $selected: boolean }>`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    padding: 10px;
    min-height: 62px;
    border: 1px solid ${({ theme, $selected }) => $selected ? theme.colors.primary : theme.colors.border};
    background: ${({ theme, $selected }) => $selected ? theme.colors.primarySubtle : theme.colors.header};
    border-radius: 7px;
    cursor: pointer;
    margin: 0;
    input { accent-color: ${({ theme }) => theme.colors.primary}; width: 14px; height: 14px; margin: 0; flex-shrink: 0; }
    &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
    &:focus-within { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
    > span:last-child { min-width: 0; }
    strong { display: block; font-size: 13px; font-weight: 600; }
    small { display: block; font-size: 11px; line-height: 1.4; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const Swatch = styled.span<{ $mode: ThemeMode }>`
    position: relative;
    width: 44px;
    height: 32px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 4px;
    background: ${({ $mode }) => themes[$mode].colors.content};
    border: 1px solid ${({ $mode }) => themes[$mode].colors.borderStrong};
    &::before { content: ''; position: absolute; inset: 0 0 auto; height: 7px; background: ${({ $mode }) => themes[$mode].colors.header}; border-bottom: 1px solid ${({ $mode }) => themes[$mode].colors.border}; }
    &::after { content: ''; position: absolute; top: 8px; left: 0; bottom: 0; width: 9px; background: ${({ $mode }) => themes[$mode].colors.sidebar}; }
    i { position: absolute; left: 14px; right: 5px; top: 13px; height: 4px; border-radius: 1px; background: ${({ $mode }) => themes[$mode].colors.primary}; }
    i + i { top: 21px; right: 12px; height: 2px; opacity: .55; }
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
                    {themeOptions.map(({ id, label, description }) => (
                        <ThemeChoice key={id} $selected={settings.themeMode === id}>
                            <input type="radio" name="theme-mode" value={id} checked={settings.themeMode === id}
                                onChange={() => change({ ...settings, themeMode: id })} />
                            <Swatch $mode={id} aria-hidden="true"><i /><i /></Swatch>
                            <span><strong>{t(label)}</strong><small>{t(description)}</small></span>
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
