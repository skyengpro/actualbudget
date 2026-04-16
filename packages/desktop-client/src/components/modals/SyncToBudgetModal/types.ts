import type {
  AccountEntity,
  CategoryEntity,
  TransactionEntity,
} from 'loot-core/types/models';

export type WizardStep = 'accounts' | 'transactions' | 'preview' | 'confirm';

export type SyncStatus = 'idle' | 'loading' | 'syncing' | 'success' | 'error';

export type SyncError = {
  type: 'validation' | 'operation';
  message: string;
};

export type TransactionWithCategory = TransactionEntity & {
  assignedCategory?: CategoryEntity['id'] | null;
  selected?: boolean;
  payeeName?: string | null;
  isTransfer?: boolean;
};

export type SyncTransactionInput = {
  id: TransactionEntity['id'];
  categoryId: CategoryEntity['id'];
};

export type PreviewTransaction = {
  id: string;
  date: string;
  amount: number;
  payee?: string | null;
  notes?: string;
  categoryId: string;
  categoryName?: string;
  isIncome: boolean;
};

export type BudgetImpact = {
  categoryId: string;
  categoryName: string;
  amount: number;
};

export type SyncPreviewResult = {
  transactions: PreviewTransaction[];
  budgetImpact: BudgetImpact[];
  totalExpenses: number;
  totalIncome: number;
  warnings: string[];
};

export type SyncExecuteResult = {
  success: boolean;
  syncGroupId: string;
  syncedCount: number;
  errors: string[];
};

export type WizardState = {
  step: WizardStep;
  fromAccountId: AccountEntity['id'] | null;
  toAccountId: AccountEntity['id'] | null;
  transactions: TransactionWithCategory[];
  selectedTransactionIds: Set<string>;
  preview: SyncPreviewResult | null;
  status: SyncStatus;
  error: SyncError | null;
  result: SyncExecuteResult | null;
};

export type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_FROM_ACCOUNT'; accountId: AccountEntity['id'] | null }
  | { type: 'SET_TO_ACCOUNT'; accountId: AccountEntity['id'] | null }
  | { type: 'SET_TRANSACTIONS'; transactions: TransactionWithCategory[] }
  | { type: 'TOGGLE_TRANSACTION'; transactionId: string }
  | { type: 'TOGGLE_ALL_TRANSACTIONS' }
  | { type: 'SET_CATEGORY'; transactionId: string; categoryId: CategoryEntity['id'] | null }
  | { type: 'SET_PREVIEW'; preview: SyncPreviewResult | null }
  | { type: 'SET_STATUS'; status: SyncStatus }
  | { type: 'SET_ERROR'; error: SyncError | null }
  | { type: 'SET_RESULT'; result: SyncExecuteResult | null }
  | { type: 'RESET' };

export const initialWizardState: WizardState = {
  step: 'accounts',
  fromAccountId: null,
  toAccountId: null,
  transactions: [],
  selectedTransactionIds: new Set(),
  preview: null,
  status: 'idle',
  error: null,
  result: null,
};

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FROM_ACCOUNT':
      return {
        ...state,
        fromAccountId: action.accountId,
        transactions: [],
        selectedTransactionIds: new Set(),
        preview: null,
      };

    case 'SET_TO_ACCOUNT':
      return { ...state, toAccountId: action.accountId };

    case 'SET_TRANSACTIONS': {
      const selectedIds = new Set(
        action.transactions.filter(t => t.selected).map(t => t.id),
      );
      return {
        ...state,
        transactions: action.transactions,
        selectedTransactionIds: selectedIds,
      };
    }

    case 'TOGGLE_TRANSACTION': {
      const newSelected = new Set(state.selectedTransactionIds);
      if (newSelected.has(action.transactionId)) {
        newSelected.delete(action.transactionId);
      } else {
        newSelected.add(action.transactionId);
      }
      return {
        ...state,
        selectedTransactionIds: newSelected,
        transactions: state.transactions.map(t =>
          t.id === action.transactionId ? { ...t, selected: newSelected.has(t.id) } : t,
        ),
      };
    }

    case 'TOGGLE_ALL_TRANSACTIONS': {
      const allSelected =
        state.selectedTransactionIds.size === state.transactions.length;
      const newSelected = allSelected
        ? new Set<string>()
        : new Set(state.transactions.map(t => t.id));
      return {
        ...state,
        selectedTransactionIds: newSelected,
        transactions: state.transactions.map(t => ({
          ...t,
          selected: newSelected.has(t.id),
        })),
      };
    }

    case 'SET_CATEGORY':
      return {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.transactionId
            ? { ...t, assignedCategory: action.categoryId }
            : t,
        ),
      };

    case 'SET_PREVIEW':
      return { ...state, preview: action.preview };

    case 'SET_STATUS':
      return { ...state, status: action.status };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_RESULT':
      return { ...state, result: action.result };

    case 'RESET':
      return initialWizardState;

    default:
      return state;
  }
}
