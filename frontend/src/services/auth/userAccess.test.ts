import { decodeUserApps, usernameValid, allAccountApps } from './userAccess.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const userAccessTests = [
    { name: 'App-Zuweisungen unterscheiden fehlende Altantworten von explizit leeren Rechten', run() {
        assert(decodeUserApps(undefined).length === allAccountApps.length, 'Altantwort muss kompatibel bleiben');
        assert(decodeUserApps([]).length === 0, 'Explizit keine Rechte bleibt leer');
        for (const invalid of [null, ['unknown'], ['wiki', 'wiki'], ['wiki', null], 'wiki']) {
            let failed = false; try { decodeUserApps(invalid); } catch { failed = true; }
            assert(failed, 'Ungültige Rechte müssen geschlossen abgewiesen werden');
        }
    } },
    { name: 'Benutzernamen sind eindeutig von E-Mail-Kennungen unterscheidbar', run() {
        assert(usernameValid('Administrator') && usernameValid(' user.name-1_2 '), 'Erlaubte Benutzernamen fehlen');
        for (const name of ['ab', 'user@example.test', 'with space', '.user', 'äöü', 'a'.repeat(65)]) assert(!usernameValid(name), 'Ungültiger Benutzername akzeptiert');
    } }
];
