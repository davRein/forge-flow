import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatPage } from '../../hooks/chatPageContext';
import type { ChatProjectSelection } from '../../hooks/chatPageContext';
import { pageContextForRoute } from '../../services/ai/pageContext';

export default function ChatPageContextProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [selection, setSelection] = useState<ChatProjectSelection | null>(null);
    const publish = useCallback((value: ChatProjectSelection | null) => setSelection(value), []);
    const page = useMemo(() => pageContextForRoute(location.pathname,
        selection?.locationKey === location.key && !(location.state as { projectOverview?: boolean } | null)?.projectOverview ? selection : null),
    [location.pathname, location.key, location.state, selection]);
    const value = useMemo(() => ({ page, publish }), [page, publish]);
    return <ChatPage.Provider value={value}>{children}</ChatPage.Provider>;
}
