// Nội dung chi tiết cho thông báo lỗi, dễ hiểu với người dùng cuối

export function errorDetail(err: unknown): string {
  // fetch ném TypeError khi không gửi/nhận được yêu cầu (mất mạng, máy chủ không phản hồi)
  if (err instanceof TypeError) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  }
  const message = err instanceof Error ? err.message : '';
  return message || 'Vui lòng thử lại sau.';
}
