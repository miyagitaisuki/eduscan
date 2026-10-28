import { apiClient } from './apiClient';

export type DocType = 'exam' | 'answer' | 'material';

export interface LibraryDocument {
  drive_file_id: string;
  name: string;
  subject: string;
  year: number | null;
  doc_type: DocType;
  tags: string;
  folder_path: string;
  mime_type: string;
  size: number;
  modified_time: string;
}

export interface DocumentFilters {
  q?: string;
  subject?: string;
  year?: number;
  type?: DocType | '';
}

export const documentService = {
  async list(filters: DocumentFilters = {}): Promise<LibraryDocument[]> {
    const params = new URLSearchParams();
    if (filters.q) params.append('q', filters.q);
    if (filters.subject) params.append('subject', filters.subject);
    if (filters.year) params.append('year', String(filters.year));
    if (filters.type) params.append('type', filters.type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<LibraryDocument[]>(`/documents${query}`);
  },

  async sync(): Promise<{ scanned: number; added: number; missing: number; total: number }> {
    return apiClient.post('/documents/sync');
  },

  // Tải file cần header Authorization nên không dùng thẻ <a href> trực tiếp
  async download(doc: LibraryDocument): Promise<void> {
    const token = apiClient.getToken();
    const res = await fetch(`/api/documents/${encodeURIComponent(doc.drive_file_id)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Tải file thất bại (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
