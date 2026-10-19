import { createApiClient } from '../api/apiClient.js';
import { createAccountRepository, passwordError } from './accountRepository.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const accountTests = [
    { name: 'Kontoverwaltung übernimmt nur öffentliche Felder und prüft Benutzerrechte', async run() {
        const user = { id: 'U', name: 'Test', email: 'u@example.test', administrator: false, active: true, passwordHash: 'darf-nicht-übernommen-werden' };
        const client = createApiClient('/api/v1', async () => new Response(JSON.stringify([user])));
        const result = await createAccountRepository(client).list();
        assert(result.length === 1 && !('passwordHash' in result[0]), 'Interne Felder dürfen nicht im Kontomodell landen');
        const invalid = createApiClient('/api/v1', async () => new Response(JSON.stringify([{ ...user, administrator: 'false' }])));
        let failed = false;
        try { await createAccountRepository(invalid).list(); } catch { failed = true; }
        assert(failed, 'Benutzerrechte müssen boolesch sein');
    } },
    { name: 'Alte Konto-Repositories dürfen nach einem Sitzungswechsel keine Benutzer anlegen', async run() {
        let calls = 0;
        const client = createApiClient('/api/v1', async () => { calls++; return new Response('{}'); });
        const repository = createAccountRepository(client);
        client.setSession('andere-sitzung');
        let failed = false;
        try { await repository.create({ name: 'X', email: 'x@example.test', password: 'Testpasswort-12345' }); } catch { failed = true; }
        assert(failed && calls === 0, 'Veraltete Verwaltung darf keine Anfrage unter einem anderen Konto senden');
    } },
    { name: 'Passwortrichtlinie zählt Unicode-Zeichen und UTF-8-Bytes getrennt', run() {
        assert(passwordError('😀'.repeat(18), '😀'.repeat(18)) === null, '72 UTF-8-Bytes sind erlaubt');
        assert(passwordError('😀'.repeat(19), '😀'.repeat(19)) !== null, '76 UTF-8-Bytes müssen abgelehnt werden');
        assert(passwordError('😀'.repeat(6), '😀'.repeat(6)) !== null, 'Sechs Zeichen sind zu kurz');
        assert(passwordError('Testpasswort-12345', 'anders') !== null, 'Bestätigung muss übereinstimmen');
        assert(passwordError('Testpasswort-12345\0', 'Testpasswort-12345\0') !== null, 'NUL ist unzulässig');
    } },
    { name: 'Kontostatus wird mit CSRF unter der festgehaltenen Sitzung geändert', async run() {
        const client = createApiClient('/api/v1', async (url, init) => {
            assert(String(url).endsWith('/users/user%2Fid/active'), 'Kennung muss als einzelnes Segment kodiert sein');
            assert(new Headers(init?.headers).get('X-CSRF-Token') === 'token', 'Änderung benötigt CSRF');
            assert(JSON.parse(String(init?.body)).active === false, 'Status muss explizit übertragen werden');
            return new Response(JSON.stringify({ id: 'user/id', email: 'u@example.test', name: 'U', active: false, administrator: false }));
        });
        client.setSession('token');
        const result = await createAccountRepository(client).setActive('user/id', false);
        assert(result.active === false, 'Serverbestätigung muss übernommen werden');
    } }
];
