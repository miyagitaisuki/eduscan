export type CredentialRole = 'teacher' | 'student';

export interface Credentials {
  role: CredentialRole;
  name: string;
  /** Tên đăng nhập (email) */
  email: string;
  password: string;
}

const ROLE_LABEL: Record<CredentialRole, string> = { teacher: 'giáo viên', student: 'học viên' };

export const roleLabel = (role: CredentialRole) => ROLE_LABEL[role];

/** Nội dung sẵn sàng gửi cho người dùng mới (Zalo, tin nhắn...) */
export function buildCredentialMessage({ name, email, password }: Credentials, loginUrl: string): string {
  return [
    'Tài khoản EduScan',
    `Họ tên: ${name}`,
    `Tên đăng nhập: ${email}`,
    `Mật khẩu tạm: ${password}`,
    `Đăng nhập tại: ${loginUrl}`,
    'Bạn sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.',
  ].join('\n');
}

/**
 * Sao chép văn bản vào clipboard. Clipboard API chỉ chạy trên HTTPS; nếu không dùng được thì thử
 * cách cũ qua ô nhập tạm. Trả false khi cả hai đều thất bại để giao diện báo người dùng tự chép.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // thử cách dự phòng bên dưới
  }
  const previouslyFocused = document.activeElement as HTMLElement | null;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  } finally {
    previouslyFocused?.focus?.();
  }
}
