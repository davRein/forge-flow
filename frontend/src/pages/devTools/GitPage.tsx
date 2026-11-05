import { useTranslation as useUiTranslation } from '../../hooks/languageContext';
import { useState } from 'react';
import { useDeveloper } from '../../hooks/developerContext';
import { useAuth } from '../../hooks/authContext';
import { useTranslation } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import type { Repositories, Repository } from '../../services/developer/developer';
import { Actions, Card, Field, Input, PrimaryButton, SecondaryButton, DangerButton, Muted, Page, Table } from './styles/toolStyles';
import DeveloperStatus from './components/DeveloperStatus';
import Dialog from '../../components/ui/Dialog';

export default function GitPage({ active }: { active: boolean }) {
    const { t: tx } = useUiTranslation();

    const dev = useDeveloper(active); const { t, language } = useTranslation(); const { user } = useAuth(); const guard = useNavigationGuard();
    const [token, setToken] = useState(''); const [repos, setRepos] = useState<Repositories | null>(null);
    const [clone, setClone] = useState<Repository | null>(null); const [disconnect, setDisconnect] = useState(false); const [message, setMessage] = useState('');
    useUnsavedChanges(active && !!token, () => setToken(''), active && dev.busy);
    const blocked = dev.busy || dev.status !== 'ready';
    const unavailable = blocked || !dev.remote || !dev.data.integrationsConfigured || !!user?.expiresAt;
    const run = async (operation: () => Promise<void>) => { setMessage(''); try { await operation(); } catch { /* Provider retains sanitized diagnostic. */ } };
    const list = async (page: number) => { const result = await dev.request<Repositories>(`/github/repositories?page=${page}`, undefined, 'GET'); setRepos(result); };
    return <Page lang={language}><h1>{tx('Git')}</h1><Muted>{t('Verbinde GitHub und klone zugängliche Repositories in deinen privaten Bereich auf dem Ubuntu-Server. Es wird kein Code ausgeführt und nichts auf deinen PC heruntergeladen.')}</Muted>
        <DeveloperStatus />
        {user?.expiresAt && <Muted>{t('Testkonten können keine externen Datenbanken oder GitHub-Zugänge verwenden.')}</Muted>}
        {!dev.data.integrationsConfigured && dev.remote && <Muted>{t('Die Administration muss zuerst INTEGRATION_SECRET_KEY konfigurieren.')}</Muted>}
        <Card><h2>{t('GitHub-Zugang')}</h2>
            <Muted>{t('Verwende einen GitHub Personal Access Token mit Zugriff auf die gewünschten Repositories: Metadata und Contents jeweils lesend. Organisationsfreigaben können zusätzlich erforderlich sein. Der Token wird verschlüsselt gespeichert und nie angezeigt.')}</Muted>
            <form onSubmit={e => { e.preventDefault(); void run(async () => { await dev.request('/github', { token }, 'POST', true); setToken(''); setRepos(null); setMessage('GitHub verbunden.'); }); }}>
                <Field>{t('Personal Access Token')}<Input type="password" autoComplete="new-password" maxLength={512} value={token} disabled={unavailable} onChange={e => setToken(e.target.value)} /></Field>
                <Actions><PrimaryButton type="submit" disabled={unavailable || !token.trim()}>{t(dev.data.githubConnected ? 'Token ersetzen' : 'GitHub verbinden')}</PrimaryButton>
                    {dev.data.githubConnected && <><span>{t('Verbunden als {name}', { name: dev.data.githubLogin })}</span><SecondaryButton type="button" disabled={blocked} onClick={() => setDisconnect(true)}>{t('Verbindung trennen')}</SecondaryButton></>}
                    <SecondaryButton type="button" disabled={blocked || !dev.remote} onClick={() => guard.request(() => void dev.load())}>{t('Neu laden')}</SecondaryButton>
                </Actions>
            </form>
        </Card>
        {dev.data.githubConnected && <Card><h2>{t('GitHub-Repositories')}</h2><Actions><SecondaryButton disabled={unavailable} onClick={() => void run(() => list(1))}>{t('Repositories laden')}</SecondaryButton></Actions>
            {repos && <><div style={{ overflowX: 'auto' }}><Table><thead><tr><th>{t('Repository')}</th><th>{t('Sichtbarkeit')}</th><th>{t('Aktion')}</th></tr></thead><tbody>{repos.items.map(repo => <tr key={repo.id}><td><a href={repo.url} target="_blank" rel="noopener noreferrer">{repo.name}</a><Muted>{repo.description}</Muted></td><td>{t(repo.privateRepo ? 'Privat' : 'Öffentlich')}</td><td><SecondaryButton disabled={unavailable || dev.data.clones.some(item => item.repositoryId === repo.id && item.status === 'ready')} onClick={() => setClone(repo)}>{t('Klonen')}</SecondaryButton></td></tr>)}</tbody></Table></div>
                <Actions><SecondaryButton disabled={unavailable || repos.page <= 1} onClick={() => void run(() => list(repos.page - 1))}>{t('Zurück')}</SecondaryButton><span>{t('Seite {page}', { page: repos.page })}</span><SecondaryButton disabled={unavailable || !repos.hasMore} onClick={() => void run(() => list(repos.page + 1))}>{t('Weiter')}</SecondaryButton></Actions>
                {!repos.items.length && <Muted>{t('Keine zugänglichen Repositories auf dieser Seite.')}</Muted>}
            </>}
        </Card>}
        <Card><h2>{t('Server-Klone')}</h2><Muted>{t('Maximal 20 Klone je Konto, jeweils ein flacher Klon ohne Submodule. Keine automatische Aktualisierung. Bestehende Klone werden nicht überschrieben.')}</Muted>
            {dev.data.clones.map(item => <p key={item.repositoryId}><strong>{item.name}</strong> · {t(item.status === 'ready' ? 'Bereit' : item.status === 'cloning' ? 'Wird geklont …' : 'Fehlgeschlagen')}<br /><code>{item.path}</code></p>)}
        </Card>
        {message && <p role="status">{t(message)}</p>}{dev.busy && <p role="status">{t('Anfrage läuft …')}</p>}
        {clone && <Dialog title={t('Repository auf dem Server klonen?')} onClose={() => { if (!dev.busy) setClone(null); }}><p>{clone.name}</p><Muted>{t('Der Klon wird privat unter dem konfigurierten DEV_GIT_ROOT gespeichert. Der Vorgang benötigt Netzwerkverkehr und Speicherplatz auf dem Server.')}</Muted><Actions><PrimaryButton disabled={unavailable} onClick={() => { const id = clone.id; setClone(null); void run(async () => { await dev.request(`/github/repositories/${id}/clone`, {}, 'POST', true); setMessage('Repository geklont.'); }); }}>{t('Jetzt klonen')}</PrimaryButton><SecondaryButton disabled={blocked} onClick={() => setClone(null)}>{t('Abbrechen')}</SecondaryButton></Actions></Dialog>}
        {disconnect && <Dialog title={t('GitHub-Verbindung trennen?')} onClose={() => { if (!dev.busy) setDisconnect(false); }}><p>{t('Der gespeicherte Token wird entfernt. Vorhandene Server-Klone bleiben erhalten.')}</p><Actions><DangerButton disabled={blocked} onClick={() => void run(async () => { await dev.request('/github', undefined, 'DELETE', true); setDisconnect(false); setRepos(null); setToken(''); })}>{t('Verbindung trennen')}</DangerButton><SecondaryButton disabled={blocked} onClick={() => setDisconnect(false)}>{t('Abbrechen')}</SecondaryButton></Actions></Dialog>}
    </Page>;
}
