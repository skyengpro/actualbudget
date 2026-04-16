export type PriorityItemKind = 'purchase' | 'todo' | 'recurring';
export type PriorityItemStatus = 'pending' | 'approved' | 'dismissed';
export type PriorityItemFrequency =
  | 'once'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export type PriorityItemEntity = {
  id: string;
  title: string;
  kind: PriorityItemKind;
  status: PriorityItemStatus;
  /** Sort order; lower = higher priority */
  priority: number;
  /** Amount in cents; negative = expense. 0 is valid for todo-kind items. */
  amount: number;
  payee_name: string | null;
  category_id: string | null;
  /** ISO 'YYYY-MM-DD' or null for undated todos */
  target_date: string | null;
  frequency: PriorityItemFrequency | null;
  notes: string | null;
  /** Set when approval converts the item to a scheduled transaction (PR 2). */
  schedule_id: string | null;
  created_at: string;
  approved_at: string | null;
  tombstone: 0 | 1;
};

export type NewPriorityItemEntity = Omit<
  PriorityItemEntity,
  | 'id'
  | 'status'
  | 'priority'
  | 'schedule_id'
  | 'created_at'
  | 'approved_at'
  | 'tombstone'
> & {
  priority?: number;
};
