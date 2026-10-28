const TOKEN_STORAGE_KEY = 'eduscan_jwt_token';
const USER_STORAGE_KEY = 'eduscan_current_user';

export const apiClient = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  },

  getCurrentUser(): any | null {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  },

  setCurrentUser(user: any) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Mọi endpoint đều nằm dưới /api. Trước đây endpoint có "/" đầu (ví dụ "/tuition")
    // bị gửi thẳng tới server, nhận HTML fallback của SPA và âm thầm trả về {}.
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = path.startsWith('/api/') ? path : `/api${path}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Không chấp nhận phản hồi không phải JSON: tránh lỗi bị nuốt thành dữ liệu rỗng
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ (HTTP ${response.status}).`);
    }
    const data = await response.json().catch(() => ({}));

    // Token hết hạn hoặc không hợp lệ: xóa phiên và báo cho app quay về màn hình đăng nhập
    if (response.status === 401 && token) {
      this.removeToken();
      window.dispatchEvent(new Event('eduscan:unauthorized'));
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return data as T;
  },

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },
};
