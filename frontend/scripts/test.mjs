import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { File } from 'node:buffer';

globalThis.File ??= File;
const suites = [
    { path: 'services/api', module: 'apiClient', tests: 'apiTests', dependencies: [] },
    { path: 'services/auth', module: 'authStore', tests: 'authTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/auth', module: 'accountRepository', tests: 'accountTests', dependencies: ['services/api/apiClient.ts'] },
    { path: 'services/workspace', module: 'workspaceStore', tests: 'workspaceTests', dependencies: ['services/workspace/workspaceSchema.ts'] },
    { path: 'services/workspace', module: 'workspaceRepository', tests: 'repositoryTests', dependencies: [
        'services/api/apiClient.ts', 'services/workspace/workspaceSchema.ts', 'services/workspace/initialWorkspace.ts',
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
        'services/settings/settingsSerialization.ts', 'services/settings/sessionSettingsRepository.ts', 'config/appSettings.ts'
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
