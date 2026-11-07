export const accountAppCatalog = [
    { key: 'projectManager', label: 'Project Manager' }, { key: 'git', label: 'Git' },
    { key: 'wiki', label: 'Dokumentation' }, { key: 'devTools', label: 'Dev Tools' },
    { key: 'timeTracker', label: 'TimeTracker' }, { key: 'business', label: 'Business' },
    { key: 'cloud', label: 'Cloud' }, { key: 'knowledgeHub', label: 'AI Knowledge Hub' },
    { key: 'flowPilot', label: 'FlowPilot' }, { key: 'pulseWatch', label: 'PulseWatch' },
    { key: 'dataScout', label: 'DataScout' }, { key: 'requestLab', label: 'RequestLab' }
] as const;
export const allAccountApps: string[] = accountAppCatalog.map(app => app.key);
export function decodeUserApps(value: unknown): string[] {
    // Compatibility with older session responses; current servers always send explicit grants.
    if (value === undefined) return [...allAccountApps];
    if (!Array.isArray(value) || value.length > allAccountApps.length || !value.every((app): app is string => typeof app === 'string' && allAccountApps.includes(app)) || new Set(value).size !== value.length) throw new Error('Ungültige App-Zuweisung.');
    return [...value];
}
export function usernameValid(value: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value.trim()); }
export function accountText(language: string, key: keyof typeof copy.de): string { return (language === 'fr' ? copy.fr : language === 'en' ? copy.en : copy.de)[key]; }
const copy = {
    de: { invalidLogin: 'Benutzername, E-Mail oder Passwort ist falsch.', login: 'Benutzername oder E-Mail', username: 'Benutzername', newUsername: 'Benutzername des neuen Benutzers', invalidUsername: 'Der Benutzername benötigt 3 bis 64 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich.', apps: 'App-Berechtigungen', permissions: 'App-Rechte bearbeiten', help: 'Nur zugewiesene und global sichtbare Apps erscheinen. Einstellungen bleiben erreichbar.', changed: 'App-Rechte gespeichert. Bestehende Sitzungen dieses Benutzers werden abgemeldet.', adminHelp: 'Administrator: Zugriff auf alle Apps.', loginHelp: 'Neue Benutzerkonten werden ausschließlich durch einen Administrator angelegt.' },
    en: { invalidLogin: 'Username, email or password is incorrect.', login: 'Username or email', username: 'Username', newUsername: 'Username for the new user', invalidUsername: 'Use 3 to 64 letters, digits, dots, underscores or hyphens for the username.', apps: 'App permissions', permissions: 'Edit app permissions', help: 'Only assigned apps that are globally visible appear. Settings remain available.', changed: 'App permissions saved. Existing sessions for this user are signed out.', adminHelp: 'Administrator: access to all apps.', loginHelp: 'New accounts can only be created by an administrator.' },
    fr: { invalidLogin: 'Le nom d’utilisateur, l’e-mail ou le mot de passe est incorrect.', login: 'Nom d’utilisateur ou e-mail', username: 'Nom d’utilisateur', newUsername: 'Nom d’utilisateur du nouveau compte', invalidUsername: 'Utilisez 3 à 64 lettres, chiffres, points, tirets ou traits de soulignement.', apps: 'Autorisations des applications', permissions: 'Modifier les autorisations', help: 'Seules les applications attribuées et visibles globalement apparaissent. Les paramètres restent accessibles.', changed: 'Autorisations enregistrées. Les sessions existantes de cet utilisateur sont déconnectées.', adminHelp: 'Administrateur : accès à toutes les applications.', loginHelp: 'Seul un administrateur peut créer de nouveaux comptes.' }
};
