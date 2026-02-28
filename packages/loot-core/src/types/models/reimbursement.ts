import type { TransactionEntity } from './transaction';

export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export type ReimbursementEntity = {
  id: string;
  transaction_id?: TransactionEntity['id'] | null;
  payment_transaction_id?: TransactionEntity['id'] | null;
  employee_name: string;
  amount: number;
  status: ReimbursementStatus;
  date_submitted: string;
  date_approved?: string | null;
  date_paid?: string | null;
  description?: string | null;
  tombstone: boolean;
};
