import { createContext, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProjectTab } from '../pages/projects/types/projectTabs.types';
import type { ChatPageContext } from '../services/ai/pageContext';

export type ChatProjectSelection = { projectId: number; projectTab: ProjectTab; locationKey: string };
export const ChatPage = createContext<{ page: ChatPageContext | null; publish?: (selection: ChatProjectSelection | null) => void }>({ page: null });
export function useChatPageContext() { return useContext(ChatPage).page; }
export function useChatProjectSelection(projectId: number | null, projectTab: ProjectTab) {
    const { publish } = useContext(ChatPage);
    const { key } = useLocation();
    useEffect(() => {
        publish?.(projectId === null ? null : { projectId, projectTab, locationKey: key });
        return () => publish?.(null);
    }, [publish, projectId, projectTab, key]);
}
