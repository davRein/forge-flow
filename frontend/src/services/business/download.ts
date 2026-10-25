import { apiClient } from '../api/runtime';
export async function downloadBusiness(path: string, filename: string) {
    const blob = await apiClient.request<Blob>(path, { responseType: 'blob' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
