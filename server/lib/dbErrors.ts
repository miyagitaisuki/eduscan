// Lỗi vi phạm unique của Postgres (23505). Driver có thể bọc lỗi gốc trong `cause`.
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}
