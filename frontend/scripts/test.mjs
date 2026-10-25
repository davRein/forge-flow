import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { File } from 'node:buffer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

globalThis.File ??= File;
const suites = [
    { path: 'pages/cloud', module: 'cloudConfig', tests: 'cloudConfigTests', dependencies: [] },
    { path: 'services/business', module: 'business', tests: 'businessTests', dependencies: ['services/api/apiClient.ts', 'services/time/timeTracking.ts'] },
    { path: 'pages/business', module: 'businessLogic', tests: 'businessLogicTests', dependencies: ['pages/timeTracker/timeLogic.ts', 'services/business/business.ts', 'services/api/apiClient.ts', 'services/time/timeTracking.ts'] },
    { path: 'services/workspace', module: 'globalSearch', tests: 'globalSearchTests', dependencies: [] },
    { path: 'services/time', module: 'timeTracking', tests: 'timeTrackingTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'pages/timeTracker', module: 'timeLogic', tests: 'timeLogicTests', dependencies: [] },
    { path: 'styles', module: 'theme', tests: 'themeTests', dependencies: [] },
    { path: 'services/rest', module: 'restCollections', tests: 'restCollectionsTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/i18n', module: 'browserLanguage', tests: 'browserLanguageTests', dependencies: [] },
    { path: 'services/settings', module: 'globalSettings', tests: 'globalSettingsTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/i18n', module: 'translate', tests: 'translationTests', dependencies: [
        'config/settingsTranslations.ts', 'config/wikiTranslations.ts', 'config/toolsTranslations.ts', 'config/commonTranslations.ts', 'config/chatTranslations.ts', 'config/timeTranslations.ts', 'config/businessTranslations.ts'
    ] },
    { path: 'services/api', module: 'apiClient', tests: 'apiTests', dependencies: [] },
    { path: 'services/ai', module: 'eventStream', tests: 'eventStreamTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/ai', module: 'navigationActions', tests: 'navigationActionTests', dependencies: [] },
    { path: 'services/ai', module: 'projectTools', tests: 'projectToolTests', dependencies: ['services/ai/navigationActions.ts', 'services/ai/workspaceActions.ts'] },
    { path: 'services/ai', module: 'pageContext', tests: 'pageContextTests', dependencies: ['config/moduleConfig.ts'] },
    { path: 'services/ai', module: 'chatRepository', tests: 'chatRepositoryTests', dependencies: ['services/api/apiClient.ts', 'services/ai/eventStream.ts', 'services/ai/projectTools.ts', 'services/ai/pageContext.ts', 'services/ai/navigationActions.ts', 'services/ai/workspaceActions.ts'] },
    { path: 'services/ai', module: 'chatStore', tests: 'chatStoreTests', dependencies: ['services/api/apiClient.ts', 'services/ai/pageContext.ts', 'services/ai/navigationActions.ts', 'services/ai/workspaceActions.ts'] },
    { path: 'services/auth', module: 'authStore', tests: 'authTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/auth', module: 'accountRepository', tests: 'accountTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/workspace', module: 'workspaceStore', tests: 'workspaceTests', dependencies: ['services/workspace/workspaceSchema.ts', 'services/workspace/recentActivity.ts', 'pages/wiki/utils/wikiLogic.ts'] },
    { path: 'services/workspace', module: 'workspaceRepository', tests: 'repositoryTests', dependencies: [
        'services/api/apiClient.ts', 'services/workspace/workspaceSchema.ts', 'services/workspace/initialWorkspace.ts', 'pages/wiki/utils/wikiLogic.ts',
        'data/projects.ts', 'data/customers.ts', 'data/tasks.ts', 'data/wiki.ts'
    ] },
    { path: 'pages/projects/tabs/sprints/utils', module: 'sprintLogic', tests: 'sprintTests', dependencies: [] },
    { path: 'pages/projects/tabs/files/utils', module: 'fileLogic', tests: 'fileTests', dependencies: [] },
    { path: 'pages/wiki/utils', module: 'wikiLogic', tests: 'wikiTests', dependencies: ['pages/wiki/utils/markdown.ts'] },
    { path: 'pages/devTools/utils', module: 'jsonLogic', tests: 'jsonTests', dependencies: [] },
    { path: 'pages/devTools/utils', module: 'calculatorLogic', tests: 'calculatorTests', dependencies: [] },
    { path: 'pages/devTools/utils', module: 'converterLogic', tests: 'converterTests', dependencies: [] },
    { path: 'pages/devTools/utils', module: 'restLogic', tests: 'restTests', dependencies: ['pages/devTools/utils/jsonLogic.ts'] },
    { path: 'services/settings', module: 'settingsStore', tests: 'settingsTests', dependencies: [
        'services/settings/settingsSerialization.ts', 'services/settings/sessionSettingsRepository.ts', 'config/appSettings.ts', 'types/settings.types.ts'
    ] }
];

const sources = new URL('../src/', import.meta.url);
const output = new URL('../node_modules/.tmp/feature-tests/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('package.json', output), '{"type":"module"}');

for (const suite of suites) {
    for (const file of [`${suite.path}/${suite.module}.ts`, `${suite.path}/${suite.module}.test.ts`, ...suite.dependencies]) {
        const source = await readFile(new URL(file, sources), 'utf8');
        const compiled = ts.transpileModule(source, {
            fileName: file,
            reportDiagnostics: true,
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
        });
        if (compiled.diagnostics?.length) {
            throw new Error(compiled.diagnostics.map((entry) => ts.flattenDiagnosticMessageText(entry.messageText, '\n')).join('\n'));
        }
        const target = new URL(file.replace(/\.ts$/, '.js'), output);
        await mkdir(new URL('./', target), { recursive: true });
        await writeFile(target, compiled.outputText);
    }
    const module = await import(new URL(`${suite.path}/${suite.module}.test.js`, output).href);
    for (const { name, run } of module[suite.tests]) {
        await test(name, run);
    }
}

// Vite transforms TSX and resolves the same component imports as the application.
const componentServer = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    esbuild: { jsx: 'automatic' },
    ssr: {
        noExternal: ['styled-components', 'react-router-dom', 'react-router'],
        resolve: { conditions: ['module-sync'] }
    }
});
try {
    const { businessPageTests } = await componentServer.ssrLoadModule('/src/pages/business/BusinessPage.test.tsx');
    for (const { name, run } of businessPageTests) await test(name, run);
    const { timeTrackerPageTests } = await componentServer.ssrLoadModule('/src/pages/timeTracker/TimeTrackerPage.test.tsx');
    for (const { name, run } of timeTrackerPageTests) await test(name, run);
    const { navigationGuardTests } = await componentServer.ssrLoadModule('/src/components/navigation/NavigationGuardProvider.test.tsx');
    for (const { name, run } of navigationGuardTests) await test(name, run);
    const { projectNavigationTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/ProjectNavigation.test.tsx');
    for (const { name, run } of projectNavigationTests) await test(name, run);
    const { restClientTests } = await componentServer.ssrLoadModule('/src/pages/devTools/components/RestClient.test.tsx');
    for (const { name, run } of restClientTests) await test(name, run);
    const { projectToolbarTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/ProjectToolbar.test.tsx');
    for (const { name, run } of projectToolbarTests) await test(name, run);
    const { documentationTests } = await componentServer.ssrLoadModule('/src/pages/wiki/Documentation.test.tsx');
    for (const { name, run } of documentationTests) await test(name, run);
    const { loginLanguageTests } = await componentServer.ssrLoadModule('/src/pages/auth/LoginPage.test.tsx');
    for (const { name, run } of loginLanguageTests) await test(name, run);
    const { customerDetailsTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/CustomerDetails.test.tsx');
    for (const { name, run } of customerDetailsTests) await test(name, run);
    const { customerFormTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/CustomerModal.test.tsx');
    for (const { name, run } of customerFormTests) await test(name, run);
    const { accountFormTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/AccountSettings.test.ts');
    for (const { name, run } of accountFormTests) await test(name, run);
    const { settingsPageTests } = await componentServer.ssrLoadModule('/src/pages/projects/components/SettingsPage.test.ts');
    for (const { name, run } of settingsPageTests) await test(name, run);
    const { localizationTests } = await componentServer.ssrLoadModule('/src/pages/localization.test.ts');
    for (const { name, run } of localizationTests) await test(name, run);
    const { notificationTests } = await componentServer.ssrLoadModule('/src/components/WorkspaceNotifications.test.ts');
    for (const { name, run } of notificationTests) await test(name, run);
    const { chatWidgetTests } = await componentServer.ssrLoadModule('/src/components/chat/ChatWidget.test.ts');
    for (const { name, run } of chatWidgetTests) await test(name, run);
    const { chatHistoryTests } = await componentServer.ssrLoadModule('/src/components/chat/ChatHistory.test.tsx');
    for (const { name, run } of chatHistoryTests) await test(name, run);
    const { workspaceCreationTests } = await componentServer.ssrLoadModule('/src/components/chat/WorkspaceCreationCard.test.tsx');
    for (const { name, run } of workspaceCreationTests) await test(name, run);
    const { chatPageContextTests } = await componentServer.ssrLoadModule('/src/hooks/chatPageContext.test.tsx');
    for (const { name, run } of chatPageContextTests) await test(name, run);
    const { chatNavigationTests } = await componentServer.ssrLoadModule('/src/hooks/chatNavigationContext.test.tsx');
    for (const { name, run } of chatNavigationTests) await test(name, run);
} finally {
    await componentServer.close();
}
