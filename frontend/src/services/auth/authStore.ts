import { ApiError } from '../api/apiClient.js';
import type { ApiClient } from '../api/apiClient';

export type AuthUser = { id: string; email: string; name: string; administrator: boolean };
type AuthState = { status: 'local' | 'checking' | 'anonymous' | 'authenticated' | 'error'; user: AuthUser | null; busy: boolean; error: string | null; notice: string | null; epoch: number };
function session(value: unknown): { user: AuthUser; csrfToken: string } {
    if (!value || typeof value !== 'object' || !('user' in value) || !('csrfToken' in value) || typeof value.csrfToken !== 'string') throw new Error('Ungültige Sitzungsantwort.');
    const user = value.user;
    if (!user || typeof user !== 'object' || !('id' in user) || !('email' in user) || !('name' in user)
        || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || typeof user.name !== 'string' || !value.csrfToken) throw new Error('Ungültige Benutzerantwort.');
    if ('administrator' in user && typeof user.administrator !== 'boolean') throw new Error('Ungültige Benutzerrechte.');
    return { user: { id: user.id, email: user.email, name: user.name, administrator: 'administrator' in user && user.administrator === true }, csrfToken: value.csrfToken };
}

export function createAuthStore(client: ApiClient, enabled: boolean) {
    let state: AuthState = { status: enabled ? 'checking' : 'local', user: null, busy: false, error: null, notice: null, epoch: client.epoch };
    let generation = 0;
    let token: string | null = null;
    const listeners = new Set<() => void>();
    const emit = (next: Partial<AuthState>) => { state = { ...state, ...next }; listeners.forEach((listener) => listener()); };
    function clear(message: string | null) {
        generation++; token = null; client.setSession(null);
        emit({ status: 'anonymous', user: null, busy: false, error: message, notice: null, epoch: client.epoch });
    }
    function accept(value: unknown) {
        const result = session(value);
        if (token !== result.csrfToken || state.user?.id !== result.user.id) client.setSession(result.csrfToken);
        token = result.csrfToken;
        emit({ status: 'authenticated', user: result.user, error: null, busy: false, epoch: client.epoch });
    }
    return {
        getSnapshot: () => state,
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        connect() { if (enabled) client.onUnauthorized(() => clear('Die Sitzung ist abgelaufen. Bitte erneut anmelden.')); },
        dispose() { generation++; client.onUnauthorized(null); },
        async refresh() {
            if (!enabled || state.busy) return;
            const run = ++generation;
            try { const result = await client.request('/auth/session', { auth: false }); if (run === generation) accept(result); }
            catch (error) {
                if (run !== generation) return;
                if (error instanceof ApiError && error.status === 401) clear(state.user ? 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.' : null);
                else emit({ status: state.user ? 'authenticated' : 'error', error: error instanceof Error ? error.message : 'Die Sitzung konnte nicht geprüft werden.' });
            }
        },
        async login(email: string, password: string) {
            if (!enabled || state.busy) return;
            const run = ++generation;
            emit({ busy: true, error: null, notice: null });
            try {
                if (!email.trim() || !password || new TextEncoder().encode(password).length > 72) throw new Error('Bitte E-Mail und ein Passwort mit höchstens 72 UTF-8-Bytes eingeben.');
                const csrf = await client.request<{ csrfToken?: unknown }>('/auth/csrf', { auth: false });
                if (typeof csrf.csrfToken !== 'string' || !csrf.csrfToken) throw new Error('Der Anmeldeschutz konnte nicht geladen werden.');
                client.setSession(csrf.csrfToken);
                const result = await client.request('/auth/login', { method: 'POST', body: { email: email.trim(), password }, auth: false });
                if (run === generation) accept(result);
            } catch (error) { if (run === generation) emit({ status: 'anonymous', busy: false, error: error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.' }); }
        },
        async logout() {
            if (!enabled || state.busy) return;
            const run = ++generation;
            emit({ busy: true, error: null });
            try { await client.request('/auth/logout', { method: 'POST', auth: false }); if (run === generation) clear(null); }
            catch (error) {
                if (run !== generation) return;
                if (error instanceof ApiError && error.status === 401) clear(null);
                else emit({ busy: false, error: error instanceof Error ? error.message : 'Abmelden fehlgeschlagen. Bitte erneut versuchen.' });
            }
        },
        async updateProfile(input: { name: string; email: string; currentPassword: string }) {
            if (!enabled || state.busy || state.status !== 'authenticated') return false;
            const run = ++generation;
            emit({ busy: true, error: null, notice: null });
            try {
                const result = await client.request('/me/profile', { method: 'PUT', body: { ...input, name: input.name.trim(), email: input.email.trim() } });
                if (run !== generation) return false;
                accept(result);
                emit({ notice: 'Profil gespeichert.' });
                return true;
            } catch (error) {
                if (run === generation) emit({ busy: false, error: error instanceof Error ? error.message : 'Profil konnte nicht gespeichert werden.' });
                return false;
            }
        },
        async changePassword(currentPassword: string, newPassword: string) {
            if (!enabled || state.busy || state.status !== 'authenticated') return false;
            const run = ++generation;
            emit({ busy: true, error: null, notice: null });
            try {
                await client.request('/me/password', { method: 'POST', body: { currentPassword, newPassword } });
                if (run !== generation) return false;
                clear(null);
                emit({ notice: 'Passwort geändert. Bitte mit dem neuen Passwort anmelden.' });
                return true;
            } catch (error) {
                if (run === generation) emit({ busy: false, error: error instanceof Error ? error.message : 'Passwort konnte nicht geändert werden.' });
                return false;
            }
        }
    };
}
export type AuthStore = ReturnType<typeof createAuthStore>;
