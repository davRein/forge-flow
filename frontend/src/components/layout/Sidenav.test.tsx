import { act, create } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { modules } from '../../config/moduleConfig';
import { showcaseProjectUrl } from '../../config/showcaseProjects';
import { darkTheme } from '../../styles/theme';
import Sidebar from './Sidenav';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export const sidenavTests = [
    { name: 'Sidebar integrates both showcase apps as modules with their original brand marks', async run() {
        let selected = '';
        const renderer = create(<ThemeProvider theme={darkTheme}><Sidebar modules={modules} activeModule="wiki" onModuleChange={key => { selected = key; }} /></ThemeProvider>);
        try {
            assert(renderer.root.findAllByType('a').length === 0, 'Apps must use suite navigation');
            for (const [index, label] of ['AI Knowledge Hub', 'FlowPilot'].entries()) {
                const link = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === label)!;
                assert(link && !link.props['aria-current'], 'Module entry missing');
                assert(link.findAllByType('i')[0].props['aria-hidden'] === 'true', 'Decorative brand mark must be present');
                await act(async () => link.props.onClick());
                assert(selected === (index === 0 ? 'knowledgeHub' : 'flowPilot'), 'App must use suite module navigation');
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
        for (const url of ['javascript:alert(1)', 'file:///D:/Projects', 'http://public.example.test', 'https://user:secret@example.test']) {
            assert(showcaseProjectUrl(url, '', false) === null, 'Invalid app destination accepted');
        }
    } }
];
