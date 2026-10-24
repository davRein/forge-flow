import { createContext } from 'react';
import type { GlobalSettingsStore } from '../services/settings/globalSettings';
export const GlobalSettingsContext = createContext<GlobalSettingsStore | null>(null);
