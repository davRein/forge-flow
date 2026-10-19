import { createApiClient } from './apiClient';

const mode = import.meta.env.VITE_DATA_MODE ?? 'local';
if (mode !== 'local' && mode !== 'api') throw new Error('VITE_DATA_MODE muss local oder api sein.');
export const apiEnabled = mode === 'api';
export const apiClient = createApiClient(import.meta.env.VITE_API_BASE_URL ?? '/api/v1');
