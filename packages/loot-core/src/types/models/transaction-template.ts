import type { AccountEntity } from './account';
import type { CategoryEntity } from './category';
import type { PayeeEntity } from './payee';

export type TransactionTemplateEntity = {
  id: string;
  name: string;
  account?: AccountEntity['id'] | null;
  payee?: PayeeEntity['id'] | null;
  category?: CategoryEntity['id'] | null;
  amount?: number | null;
  notes?: string | null;
  active: boolean;
  tombstone: boolean;
};
