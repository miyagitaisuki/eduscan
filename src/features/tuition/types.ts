export interface Payment {
  id: string;
  student_id: string;
  month: string; // e.g. "10/2026"
  amount: number;
  paid_date: string | null; // YYYY-MM-DD or null if unpaid
  status: 'paid' | 'unpaid';
  notes: string;
}
