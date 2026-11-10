import { act, create } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { modules } from '../../config/moduleConfig';
import { showcaseProjectUrl, dataScoutUrl } from '../../config/showcaseProjects';
import { darkTheme } from '../../styles/theme';
import Sidebar from './Sidenav';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export const sidenavTests = [
    { name: 'Sidebar integrates showcase apps as modules with their original brand marks', async run() {
        let selected = '';
        const renderer = create(<ThemeProvider theme={darkTheme}><Sidebar modules={modules} activeModule="wiki" onModuleChange={key => { selected = key; }} /></ThemeProvider>);
        try {
            assert(renderer.root.findAllByType('a').length === 0, 'Apps must use suite navigation');
            const moduleKeys = ['knowledgeHub', 'flowPilot', 'pulseWatch', 'dataScout'] as const;
            for (const [index, label] of ['AI Knowledge Hub', 'FlowPilot', 'PulseWatch', 'DataScout'].entries()) {
                const link = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === label)!;
                assert(link && !link.props['aria-current'], 'Module entry missing');
                assert(link.findAllByType('i')[0].props['aria-hidden'] === 'true', 'Decorative brand mark must be present');
                await act(async () => link.props.onClick());
                assert(selected === moduleKeys[index], 'App must use suite module navigation');
            }
            const wiki = renderer.root.findAllByType('button').find(button => button.props['aria-current'] === 'page');
            assert(wiki, 'Existing module selection must remain active');
            await act(async () => wiki.props.onClick());
            assert(selected === 'wiki', 'Existing module navigation must still work');
        } finally { await act(async () => renderer.unmount()); }
    } },
    { name: 'Showcase destinations use local development defaults and explicit deployment configuration', run() {
        assert(showcaseProjectUrl(undefined, 'http://localhost:3000', true) === 'http://localhost:3000/', 'Local development default missing');
        assert(showcaseProjectUrl(undefined, 'http://localhost:3000', false) === null, 'Production must not link to a visitor computer');
        assert(showcaseProjectUrl('', 'http://localhost:3000', true) === null, 'Empty configuration must disable the app');
        assert(showcaseProjectUrl(' https://apps.example.test/hub ', '', false) === 'https://apps.example.test/hub', 'Deployment URL must be configurable');
        assert(showcaseProjectUrl(undefined, 'http://localhost:5177', true) === 'http://localhost:5177/', 'PulseWatch development default missing');
        assert(dataScoutUrl(undefined, true) === 'http://localhost:5176/', 'DataScout local port missing');
        assert(dataScoutUrl(undefined, false) === null && dataScoutUrl('http://localhost:5176', false) === null, 'DataScout must reject missing or local production targets');
        assert(dataScoutUrl('https://forge-flow.de/datascout/', false) === 'https://forge-flow.de/datascout/', 'Protected production target missing');
        assert(dataScoutUrl('https://public.example.test', true) === null && dataScoutUrl('', true) === null, 'DataScout must reject external/empty targets');
        for (const url of ['javascript:alert(1)', 'file:///D:/Projects', 'http://public.example.test', 'https://user:secret@example.test']) {
            assert(showcaseProjectUrl(url, '', false) === null, 'Invalid app destination accepted');
        }
    } }
];
