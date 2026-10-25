import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { LanguageContext } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import { darkTheme } from '../../styles/theme';
import NavigationGuardProvider from './NavigationGuardProvider';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(dirtyInitially: boolean) {
    let state!: { setPending: (value: boolean) => void }; let navigations = 0, discarded = 0;
    function Editor() {
        const [dirty, setDirty] = useState(dirtyInitially); const [pending, setPending] = useState(true); state = { setPending };
        useUnsavedChanges(dirty, () => { discarded++; setDirty(false); }, pending);
        const guard = useNavigationGuard(); return <button onClick={() => guard.request(() => navigations++)}>Navigate</button>;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><NavigationGuardProvider><Editor /></NavigationGuardProvider></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {} }; } }); });
    return { get root() { return renderer.root; }, get navigations() { return navigations; }, get discarded() { return discarded; },
        async click(label: string) { const button = renderer.root.findAllByType('button').find(node => text(node) === label); assert(button && !button.props.disabled, `Missing button: ${label}`); await act(async () => { button.props.onClick(); }); },
        async complete() { await act(async () => { state.setPending(false); }); }, async close() { await act(async () => { renderer.unmount(); }); }
    };
}
export const navigationGuardTests = [
    { name: 'A navigation requested during a save waits and proceeds when the confirmed save clears pending changes', async run() {
        const ui = await fixture(false); try {
            await ui.click('Navigate'); assert(Number(ui.navigations) === 0 && ui.root.findAllByType('dialog').length === 1, 'In-flight saves must pause navigation');
            assert(ui.root.findAllByType('button').find(node => text(node) === 'Discard changes and continue')?.props.disabled, 'An in-flight write cannot be discarded');
            await ui.complete(); assert(Number(ui.navigations) === 1 && Number(ui.discarded) === 0 && ui.root.findAllByType('dialog').length === 0, 'Successful save should continue without discarding confirmed changes');
        } finally { await ui.close(); }
    } },
    { name: 'Failed saves still require an explicit discard; dismissing the warning retains the draft', async run() {
        const ui = await fixture(true); try {
            await ui.click('Navigate'); await ui.complete(); assert(Number(ui.navigations) === 0 && Number(ui.discarded) === 0, 'Remaining edits must keep navigation blocked');
            await ui.click('Stay on this page'); assert(Number(ui.navigations) === 0 && Number(ui.discarded) === 0, 'Stay must not discard');
            await ui.click('Navigate'); await ui.click('Discard changes and continue'); assert(Number(ui.navigations) === 1 && Number(ui.discarded) === 1, 'Only explicit confirmation may discard and navigate');
        } finally { await ui.close(); }
    } }
];
