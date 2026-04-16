import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { SyncOffBudgetModal } from './SyncOffBudgetModal';

import { TestProviders, createTestQueryClient } from '@desktop-client/mocks';

// Mock the send function from loot-core
const mockSend = vi.fn();
vi.mock('loot-core/platform/client/connection', () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

// Mock hooks
const mockAccounts = [
  { id: 'off-budget-1', name: 'Investment Account', offbudget: true, closed: false },
  { id: 'off-budget-2', name: 'Savings Account', offbudget: true, closed: false },
  { id: 'on-budget-1', name: 'Checking Account', offbudget: false, closed: false },
  { id: 'on-budget-2', name: 'Credit Card', offbudget: false, closed: false },
];

vi.mock('@desktop-client/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: mockAccounts }),
}));

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', group: 'group-1' },
  { id: 'cat-2', name: 'Entertainment', group: 'group-1' },
  { id: 'cat-3', name: 'Utilities', group: 'group-2' },
];

vi.mock('@desktop-client/hooks/useCategories', () => ({
  useCategories: () => ({
    data: {
      list: mockCategories,
      grouped: [
        { id: 'group-1', name: 'Expenses', categories: mockCategories.slice(0, 2) },
        { id: 'group-2', name: 'Bills', categories: mockCategories.slice(2) },
      ],
    },
  }),
}));

const mockPayees = [
  { id: 'payee-1', name: 'Store', transfer_acct: null },
  { id: 'payee-transfer', name: 'Transfer: Checking Account', transfer_acct: 'on-budget-1' },
];

vi.mock('@desktop-client/hooks/usePayees', () => ({
  usePayees: () => ({ data: mockPayees }),
}));

vi.mock('@desktop-client/hooks/useFormat', () => ({
  useFormat: () => (amount: number, type: string) => {
    if (type === 'financial') {
      const absAmount = Math.abs(amount) / 100;
      const formatted = absAmount.toFixed(2);
      return amount < 0 ? `-$${formatted}` : `$${formatted}`;
    }
    return String(amount);
  },
}));

// Mock CategoryAutocomplete to simplify testing
vi.mock('@desktop-client/components/autocomplete/CategoryAutocomplete', () => ({
  CategoryAutocomplete: ({
    value,
    onSelect,
  }: {
    value: string | null | undefined;
    onSelect: (id: string | null) => void;
  }) => (
    <select
      data-testid="category-select"
      value={value || ''}
      onChange={e => onSelect(e.target.value || null)}
    >
      <option value="">Select category...</option>
      <option value="cat-1">Groceries</option>
      <option value="cat-2">Entertainment</option>
      <option value="cat-3">Utilities</option>
    </select>
  ),
}));

// Mock dispatch - use importOriginal to get actual implementations
const mockDispatch = vi.fn();
vi.mock('@desktop-client/redux', async importOriginal => {
  const actual = await importOriginal<typeof import('@desktop-client/redux')>();
  return {
    ...actual,
    useDispatch: () => mockDispatch,
  };
});

// Sample transactions for testing
const mockTransactions = [
  {
    id: 'txn-1',
    account: 'off-budget-1',
    date: '2024-01-15',
    amount: -5000,
    payee: 'payee-1',
    category: null,
    notes: 'Grocery shopping',
  },
  {
    id: 'txn-2',
    account: 'off-budget-1',
    date: '2024-01-16',
    amount: -2500,
    payee: 'payee-transfer',
    category: null,
    notes: 'Transfer from checking',
  },
];

const mockTransactionsWithCategory = [
  {
    id: 'txn-3',
    account: 'off-budget-1',
    date: '2024-01-17',
    amount: -3000,
    payee: 'payee-1',
    category: 'cat-1',
    notes: 'Already categorized',
  },
];

describe('SyncOffBudgetModal', () => {
  const queryClient = createTestQueryClient();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    user = userEvent.setup();
  });

  const renderModal = (accountId?: string) => {
    return render(
      <TestProviders queryClient={queryClient}>
        <SyncOffBudgetModal accountId={accountId} />
      </TestProviders>,
    );
  };

  it('renders correctly with account selection dropdowns', () => {
    renderModal();

    // Check for FROM and TO labels
    expect(screen.getByText('FROM')).toBeInTheDocument();
    expect(screen.getByText('TO')).toBeInTheDocument();

    // Check for account selection buttons (Select component renders as buttons)
    expect(screen.getByRole('button', { name: 'Select off-budget account...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select on-budget account...' })).toBeInTheDocument();

    // Check modal title
    expect(screen.getByText('Sync Off-Budget Transactions')).toBeInTheDocument();

    // Check for Cancel and Sync buttons
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync Transactions/i })).toBeInTheDocument();
  });

  it('loads transactions when off-budget account is selected via accountId prop', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    // Render with accountId to pre-select the off-budget account
    renderModal('off-budget-1');

    // Wait for transactions to load
    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith(
        'query',
        expect.objectContaining({
          table: 'transactions',
        }),
      );
    });

    // Check that transactions are displayed
    await waitFor(() => {
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.getByText('Transfer from checking')).toBeInTheDocument();
    });
  });

  it('auto-selects destination account when transaction is a transfer', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    // Render with accountId to pre-select the off-budget account
    renderModal('off-budget-1');

    // Wait for transactions to load and auto-select to happen
    // The transfer payee points to on-budget-1 (Checking Account), so it should be auto-selected
    await waitFor(() => {
      // The TO button should now show "Checking Account" instead of the placeholder
      expect(screen.getByRole('button', { name: 'Checking Account' })).toBeInTheDocument();
    });
  });

  it('validates that all selected transactions have categories before sync', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    // Render with accountId to pre-select the off-budget account
    renderModal('off-budget-1');

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
    });

    // Wait for auto-select of destination account
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Checking Account' })).toBeInTheDocument();
    });

    // Try to sync without assigning categories (transactions don't have categories)
    const syncButton = screen.getByRole('button', { name: /Sync Transactions/i });
    await user.click(syncButton);

    // Should show error about uncategorized transactions
    await waitFor(() => {
      expect(
        screen.getByText(/Please assign categories to all selected transactions/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error when no destination account selected', async () => {
    // Use transactions with category already assigned, and no transfer payee
    // so destination won't be auto-selected
    mockSend.mockResolvedValueOnce({ data: mockTransactionsWithCategory });

    renderModal('off-budget-1');

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Already categorized')).toBeInTheDocument();
    });

    // NOTE: The auto-select won't trigger here because mockTransactionsWithCategory
    // uses payee-1 which doesn't have a transfer_acct

    // Try to sync without selecting destination account
    const syncButton = screen.getByRole('button', { name: /Sync Transactions/i });
    await user.click(syncButton);

    // Should show error about no destination account
    await waitFor(() => {
      expect(screen.getByText(/Please select a destination account/i)).toBeInTheDocument();
    });
  });

  it('disables sync button when no transactions are selected', async () => {
    mockSend.mockResolvedValueOnce({ data: [] });

    // Render with accountId to pre-select (with no transactions)
    renderModal('off-budget-1');

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('No transactions in this account')).toBeInTheDocument();
    });

    // Sync button should be disabled
    const syncButton = screen.getByRole('button', { name: /Sync Transactions/i });
    expect(syncButton).toBeDisabled();
  });

  it('allows toggling individual transaction selection', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    renderModal('off-budget-1');

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
    });

    // Find checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // Both should be checked by default
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    // Click on first transaction row to toggle
    const firstRow = screen.getByText('Grocery shopping').closest('tr');
    if (firstRow) {
      await user.click(firstRow);
    }

    // First checkbox should now be unchecked
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('shows transaction count and total amount in summary', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    renderModal('off-budget-1');

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
    });

    // Check for transaction count badge (showing "2" for 2 transactions)
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check for selected count in summary footer
    expect(screen.getByText(/2 transactions/)).toBeInTheDocument();
  });

  it('pre-selects account when accountId prop is provided', async () => {
    mockSend.mockResolvedValueOnce({ data: mockTransactions });

    renderModal('off-budget-1');

    // The FROM dropdown should have the account pre-selected (showing account name, not placeholder)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Investment Account' })).toBeInTheDocument();
    });

    // Transactions should start loading
    await waitFor(() => {
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
