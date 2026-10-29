export type Notify = (type: 'success' | 'warning' | 'info', title: string, subtitle?: string) => void;

/** Kết quả một lần tải: true nếu thành công. Khi lỗi, dữ liệu cũ được giữ nguyên. */
export type Loader = () => Promise<boolean>;
