import { v4 as uuidv4 } from 'uuid';

import { q } from '../../shared/query';
import type {
  AccountEntity,
  CategoryEntity,
  TransactionEntity,
} from '../../types/models';
import { aqlQuery } from '../aql';
import { createApp } from '../app';
import * as db from '../db';
import { mutator } from '../mutators';
import { batchMessages } from '../sync';
import { undoable } from '../undo';

const OFF_BUDGET_CATEGORY_NAME = 'Off-Budget Adjustments';
const OFF_BUDGET_GROUP_NAME = 'Off-Budget';

/**
 * Find or create the "Off-Budget Adjustments" category for offset transactions
 */
async function getOrCreateOffBudgetCategory(): Promise<string> {
  // Look for existing category
  const existingCategory = await db.first<{ id: string }>(
    `SELECT id FROM categories WHERE name = ? AND tombstone = 0`,
    [OFF_BUDGET_CATEGORY_NAME],
  );

  if (existingCategory) {
    return existingCategory.id;
  }

  // Need to create category - first find or create the group
  let groupId: string;
  const existingGroup = await db.first<{ id: string }>(
    `SELECT id FROM category_groups WHERE name = ? AND tombstone = 0`,
    [OFF_BUDGET_GROUP_NAME],
  );

  if (existingGroup) {
    groupId = existingGroup.id;
  } else {
    // Create the group
    groupId = uuidv4();
    await db.insertCategoryGroup({
      id: groupId,
      name: OFF_BUDGET_GROUP_NAME,
      is_income: 0,
    });
  }

  // Create the category
  const categoryId = uuidv4();
  await db.insertCategory({
    id: categoryId,
    name: OFF_BUDGET_CATEGORY_NAME,
    cat_group: groupId,
  });

  return categoryId;
}

// Types for preview and execute operations
export type SyncTransactionInput = {
  id: TransactionEntity['id'];
  categoryId: CategoryEntity['id'];
};

export type SyncPreviewResult = {
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    payee?: string | null;
    notes?: string;
    categoryId: string;
    categoryName?: string;
    isIncome: boolean;
  }>;
  budgetImpact: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
  }>;
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

export type SyncOffBudgetHandlers = {
  'sync-off-budget-preview': typeof preview;
  'sync-off-budget-execute': typeof execute;
  'sync-off-budget-undo': typeof undoSync;
};

/**
 * Preview sync operation - calculate budget impact without executing
 */
async function preview({
  fromAccountId,
  toAccountId,
  transactions: transactionInputs,
}: {
  fromAccountId: AccountEntity['id'];
  toAccountId: AccountEntity['id'];
  transactions: SyncTransactionInput[];
}): Promise<SyncPreviewResult> {
  const warnings: string[] = [];

  // Validate accounts
  const fromAccount = await db.first<db.DbAccount>(
    'SELECT * FROM accounts WHERE id = ? AND tombstone = 0',
    [fromAccountId],
  );
  const toAccount = await db.first<db.DbAccount>(
    'SELECT * FROM accounts WHERE id = ? AND tombstone = 0',
    [toAccountId],
  );

  if (!fromAccount) {
    throw new Error('Source account not found');
  }
  if (!toAccount) {
    throw new Error('Destination account not found');
  }
  if (!fromAccount.offbudget) {
    warnings.push('Source account is not an off-budget account');
  }
  if (toAccount.offbudget) {
    warnings.push('Destination account is an off-budget account');
  }

  // Get transaction IDs
  const txnIds = transactionInputs.map(t => t.id);
  if (txnIds.length === 0) {
    return {
      transactions: [],
      budgetImpact: [],
      totalExpenses: 0,
      totalIncome: 0,
      warnings,
    };
  }

  // Fetch transactions
  const { data: transactions } = await aqlQuery(
    q('transactions')
      .filter({ id: { $oneof: txnIds }, tombstone: false })
      .select('*'),
  );

  // Build category map from inputs
  const categoryMap = new Map<string, string>();
  transactionInputs.forEach(t => {
    categoryMap.set(t.id, t.categoryId);
  });

  // Get all categories for names
  const categories = await db.all<Pick<db.DbCategory, 'id' | 'name'>>(
    'SELECT id, name FROM categories WHERE tombstone = 0',
  );
  const categoryNameMap = new Map<string, string>();
  categories.forEach(c => {
    categoryNameMap.set(c.id, c.name);
  });

  // Get payees for display
  const payees = await db.all<Pick<db.DbPayee, 'id' | 'name'>>(
    'SELECT id, name FROM payees WHERE tombstone = 0',
  );
  const payeeNameMap = new Map<string, string>();
  payees.forEach(p => {
    payeeNameMap.set(p.id, p.name);
  });

  // Calculate budget impact
  const budgetImpactMap = new Map<string, number>();
  let totalExpenses = 0;
  let totalIncome = 0;

  const previewTransactions = transactions.map(
    (txn: TransactionEntity & { payee?: string }) => {
      const categoryId = categoryMap.get(txn.id) || '';
      const amount = txn.amount || 0;
      const isIncome = amount > 0;

      if (isIncome) {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
      }

      // Accumulate by category
      if (categoryId) {
        const current = budgetImpactMap.get(categoryId) || 0;
        budgetImpactMap.set(categoryId, current + amount);
      }

      return {
        id: txn.id,
        date: txn.date,
        amount,
        payee: txn.payee ? payeeNameMap.get(txn.payee) || null : null,
        notes: txn.notes,
        categoryId,
        categoryName: categoryId ? categoryNameMap.get(categoryId) : undefined,
        isIncome,
      };
    },
  );

  // Convert budget impact map to array
  const budgetImpact = Array.from(budgetImpactMap.entries()).map(
    ([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryNameMap.get(categoryId) || 'Unknown',
      amount,
    }),
  );

  return {
    transactions: previewTransactions,
    budgetImpact,
    totalExpenses,
    totalIncome,
    warnings,
  };
}

/**
 * Execute sync operation - atomic sync wrapped in undoable
 */
async function execute({
  fromAccountId,
  toAccountId,
  transactions: transactionInputs,
}: {
  fromAccountId: AccountEntity['id'];
  toAccountId: AccountEntity['id'];
  transactions: SyncTransactionInput[];
}): Promise<SyncExecuteResult> {
  const errors: string[] = [];
  const syncGroupId = uuidv4();
  let syncedCount = 0;

  // Validate accounts
  const fromAccount = await db.first<db.DbAccount>(
    'SELECT * FROM accounts WHERE id = ? AND tombstone = 0',
    [fromAccountId],
  );
  const toAccount = await db.first<db.DbAccount>(
    'SELECT * FROM accounts WHERE id = ? AND tombstone = 0',
    [toAccountId],
  );

  if (!fromAccount) {
    return { success: false, syncGroupId, syncedCount: 0, errors: ['Source account not found'] };
  }
  if (!toAccount) {
    return { success: false, syncGroupId, syncedCount: 0, errors: ['Destination account not found'] };
  }

  // Get transaction IDs and category map
  const txnIds = transactionInputs.map(t => t.id);
  const categoryMap = new Map<string, string>();
  transactionInputs.forEach(t => {
    categoryMap.set(t.id, t.categoryId);
  });

  if (txnIds.length === 0) {
    return { success: true, syncGroupId, syncedCount: 0, errors: [] };
  }

  // Fetch transactions
  const { data: transactions } = await aqlQuery(
    q('transactions')
      .filter({ id: { $oneof: txnIds }, tombstone: false })
      .select('*'),
  );

  // Get payees to check for transfers
  const payees = await db.all<Pick<db.DbPayee, 'id' | 'transfer_acct'>>(
    'SELECT id, transfer_acct FROM payees WHERE tombstone = 0',
  );
  const payeeTransferMap = new Map<string, string | null>();
  payees.forEach(p => {
    payeeTransferMap.set(p.id, p.transfer_acct || null);
  });

  // Get or create the "Off-Budget Adjustments" category for offset transactions
  const offBudgetCategoryId = await getOrCreateOffBudgetCategory();

  // Process all transactions within a batch for atomicity
  // Logic: Sync off-budget transactions to affect budget categories
  //
  // What happens:
  // 1. Delete transaction from off-budget → reduces off-budget balance
  // 2. Create categorized expense in on-budget → affects budget category
  // 3. Create offset in on-budget with "Off-Budget Adjustments" category → keeps on-budget balance unchanged
  await batchMessages(async () => {
    for (const txn of transactions as TransactionEntity[]) {
      const categoryId = categoryMap.get(txn.id);
      if (!categoryId) {
        errors.push(`Transaction ${txn.id} has no category assigned`);
        continue;
      }

      const amount = txn.amount || 0;
      // For budget impact: positive amounts become expenses (negative)
      const budgetAmount = amount > 0 ? -amount : amount;

      // Step 1: Create the categorized expense in on-budget (affects budget)
      const newTxnId = uuidv4();
      await db.insertTransaction({
        id: newTxnId,
        account: toAccountId,
        date: txn.date,
        amount: budgetAmount,
        payee: txn.payee,
        category: categoryId,
        notes: txn.notes || '',
        cleared: true,
      });

      // Step 2: Create offsetting transaction to keep on-budget balance unchanged
      // Uses "Off-Budget Adjustments" category so it's not uncategorized
      const offsetTxnId = uuidv4();
      await db.insertTransaction({
        id: offsetTxnId,
        account: toAccountId,
        date: txn.date,
        amount: -budgetAmount,
        payee: txn.payee,
        category: offBudgetCategoryId,
        notes: `[From: ${fromAccount.name}]`,
        cleared: true,
      });

      // Step 3: Delete from off-budget (reduces off-budget balance)
      await db.deleteTransaction({ id: txn.id });

      syncedCount++;
    }
  });

  return {
    success: errors.length === 0,
    syncGroupId,
    syncedCount,
    errors,
  };
}

/**
 * Undo a sync operation by sync_group_id
 * Note: This is a placeholder - use Cmd/Ctrl+Z for undo instead
 */
async function undoSync({
  syncGroupId,
}: {
  syncGroupId: string;
}): Promise<{ success: boolean; restoredCount: number; errors: string[] }> {
  // Without sync metadata fields in the database, we can't track sync groups
  // Users should use Cmd/Ctrl+Z for undo which is handled by the undoable() wrapper
  return {
    success: false,
    restoredCount: 0,
    errors: ['Please use Cmd/Ctrl+Z to undo. Sync group tracking is not available.'],
  };
}

export const app = createApp<SyncOffBudgetHandlers>();

app.method('sync-off-budget-preview', preview);
app.method('sync-off-budget-execute', mutator(undoable(execute)));
app.method('sync-off-budget-undo', mutator(undoable(undoSync)));
