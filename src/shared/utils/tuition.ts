import type { TuitionRecord } from '../types';

type TuitionLike = Pick<TuitionRecord, 'status' | 'amount' | 'paid_amount'>;

/** Số tiền còn nợ của một hồ sơ: chưa đóng hoặc đóng một phần */
export const tuitionDebt = (t: TuitionLike): number =>
  t.status === 'paid' ? 0 : Math.max(t.amount - (t.paid_amount ?? 0), 0);

/** Số tiền đã thu thực tế (đóng đủ hoặc một phần) */
export const tuitionCollected = (t: TuitionLike): number =>
  t.status === 'unpaid' ? 0 : t.paid_amount ?? t.amount;

/** Hồ sơ chưa đóng đủ (gồm đóng một phần) */
export const isTuitionOutstanding = (status: TuitionRecord['status']): boolean => status !== 'paid';
