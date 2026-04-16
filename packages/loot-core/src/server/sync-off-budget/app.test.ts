// @ts-strict-ignore
import { q } from '../../shared/query';
import { aqlQuery } from '../aql';
import * as db from '../db';

import { app } from './app';

// Extract the handlers for testing
const preview = app.handlers['sync-off-budget-preview'];
const execute = app.handlers['sync-off-budget-execute'];

beforeEach(global.emptyDatabase());

/**
 * Helper to get all transactions from a specific account
 */
async function getTransactionsForAccount(accountId: string) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ account: accountId, tombstone: false })
      .select(['id', 'date', 'amount', 'payee', 'category', 'notes', 'cleared']),
  );
  return data;
}

/**
 * Helper to prepare the database with accounts and categories
 */
async function prepareDatabase() {
  // Create category groups
  await db.insertCategoryGroup({
    id: 'expense-group',
    name: 'Expenses',
    is_income: 0,
  });

  // Create categories
  await db.insertCategory({
    id: 'food-cat',
    name: 'Food',
    cat_group: 'expense-group',
  });
  await db.insertCategory({
    id: 'utilities-cat',
    name: 'Utilities',
    cat_group: 'expense-group',
  });

  // Create off-budget account (source)
  await db.insertAccount({
    id: 'offbudget-account',
    name: 'Credit Card (Off-Budget)',
    offbudget: 1,
  });

  // Create on-budget account (destination)
  await db.insertAccount({
    id: 'onbudget-account',
    name: 'Checking',
    offbudget: 0,
  });

  // Create a payee
  await db.insertPayee({
    id: 'payee1',
    name: 'Grocery Store',
  });
}

describe('sync-off-budget handlers', () => {
  describe('getOrCreateOffBudgetCategory', () => {
    it('should create category if it does not exist', async () => {
      await prepareDatabase();

      // Insert a transaction in the off-budget account
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000, // -$50.00
        payee: 'payee1',
        notes: 'Groceries',
      });

      // Execute the sync - this should create the Off-Budget Adjustments category
      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Verify the Off-Budget Adjustments category was created
      const category = await db.first<{ id: string; name: string }>(
        `SELECT id, name FROM categories WHERE name = ? AND tombstone = 0`,
        ['Off-Budget Adjustments'],
      );
      expect(category).toBeTruthy();
      expect(category.name).toBe('Off-Budget Adjustments');

      // Verify the Off-Budget group was created
      const group = await db.first<{ id: string; name: string }>(
        `SELECT id, name FROM category_groups WHERE name = ? AND tombstone = 0`,
        ['Off-Budget'],
      );
      expect(group).toBeTruthy();
      expect(group.name).toBe('Off-Budget');
    });

    it('should return existing category if it already exists', async () => {
      await prepareDatabase();

      // Manually create the Off-Budget category group and category
      await db.insertCategoryGroup({
        id: 'offbudget-group',
        name: 'Off-Budget',
        is_income: 0,
      });
      await db.insertCategory({
        id: 'offbudget-adj-cat',
        name: 'Off-Budget Adjustments',
        cat_group: 'offbudget-group',
      });

      // Insert a transaction
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });

      // Execute the sync
      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Verify no duplicate category was created
      const categories = await db.all<{ id: string }>(
        `SELECT id FROM categories WHERE name = ? AND tombstone = 0`,
        ['Off-Budget Adjustments'],
      );
      expect(categories.length).toBe(1);
      expect(categories[0].id).toBe('offbudget-adj-cat');
    });
  });

  describe('sync-off-budget-preview', () => {
    it('should return correct preview data for transactions', async () => {
      await prepareDatabase();

      // Insert transactions in the off-budget account
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000, // -$50.00 expense
        payee: 'payee1',
        notes: 'Groceries',
      });
      await db.insertTransaction({
        id: 'txn2',
        account: 'offbudget-account',
        date: '2024-01-16',
        amount: -3000, // -$30.00 expense
        payee: 'payee1',
        notes: 'Utilities bill',
      });

      const result = await preview({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [
          { id: 'txn1', categoryId: 'food-cat' },
          { id: 'txn2', categoryId: 'utilities-cat' },
        ],
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.totalExpenses).toBe(-8000); // -$80.00 total
      expect(result.totalIncome).toBe(0);
      expect(result.warnings).toHaveLength(0);

      // Check budget impact
      expect(result.budgetImpact).toHaveLength(2);

      const foodImpact = result.budgetImpact.find(
        b => b.categoryId === 'food-cat',
      );
      expect(foodImpact).toBeTruthy();
      expect(foodImpact.amount).toBe(-5000);

      const utilitiesImpact = result.budgetImpact.find(
        b => b.categoryId === 'utilities-cat',
      );
      expect(utilitiesImpact).toBeTruthy();
      expect(utilitiesImpact.amount).toBe(-3000);
    });

    it('should aggregate budget impact by category', async () => {
      await prepareDatabase();

      // Insert multiple transactions for the same category
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });
      await db.insertTransaction({
        id: 'txn2',
        account: 'offbudget-account',
        date: '2024-01-16',
        amount: -3000,
        payee: 'payee1',
      });

      const result = await preview({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [
          { id: 'txn1', categoryId: 'food-cat' },
          { id: 'txn2', categoryId: 'food-cat' }, // Same category
        ],
      });

      // Budget impact should be aggregated
      expect(result.budgetImpact).toHaveLength(1);
      expect(result.budgetImpact[0].categoryId).toBe('food-cat');
      expect(result.budgetImpact[0].amount).toBe(-8000); // Combined amount
    });

    it('should return warnings for invalid account types', async () => {
      await prepareDatabase();

      // Create another on-budget account to use as source (wrong type)
      await db.insertAccount({
        id: 'another-onbudget',
        name: 'Savings',
        offbudget: 0,
      });

      // Create an off-budget account to use as destination (wrong type)
      await db.insertAccount({
        id: 'another-offbudget',
        name: 'Investment',
        offbudget: 1,
      });

      await db.insertTransaction({
        id: 'txn1',
        account: 'another-onbudget',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });

      const result = await preview({
        fromAccountId: 'another-onbudget', // Not off-budget
        toAccountId: 'another-offbudget', // Not on-budget
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      expect(result.warnings).toContain(
        'Source account is not an off-budget account',
      );
      expect(result.warnings).toContain(
        'Destination account is an off-budget account',
      );
    });

    it('should return empty result for empty transactions', async () => {
      await prepareDatabase();

      const result = await preview({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [],
      });

      expect(result.transactions).toHaveLength(0);
      expect(result.budgetImpact).toHaveLength(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.totalIncome).toBe(0);
    });

    it('should throw error for non-existent source account', async () => {
      await prepareDatabase();

      await expect(
        preview({
          fromAccountId: 'non-existent',
          toAccountId: 'onbudget-account',
          transactions: [],
        }),
      ).rejects.toThrow('Source account not found');
    });

    it('should throw error for non-existent destination account', async () => {
      await prepareDatabase();

      await expect(
        preview({
          fromAccountId: 'offbudget-account',
          toAccountId: 'non-existent',
          transactions: [],
        }),
      ).rejects.toThrow('Destination account not found');
    });

    it('should correctly identify income transactions', async () => {
      await prepareDatabase();

      // Insert an income transaction (positive amount)
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: 10000, // +$100.00 income/refund
        payee: 'payee1',
        notes: 'Refund',
      });

      const result = await preview({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      expect(result.transactions[0].isIncome).toBe(true);
      expect(result.totalIncome).toBe(10000);
      expect(result.totalExpenses).toBe(0);
    });
  });

  describe('sync-off-budget-execute', () => {
    it('should create transactions correctly', async () => {
      await prepareDatabase();

      // Insert a transaction in the off-budget account
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000, // -$50.00 expense
        payee: 'payee1',
        notes: 'Groceries',
      });

      const result = await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should delete transactions from source account', async () => {
      await prepareDatabase();

      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });

      // Verify transaction exists before sync
      let offBudgetTxns = await getTransactionsForAccount('offbudget-account');
      expect(offBudgetTxns).toHaveLength(1);

      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Verify transaction is deleted from source
      offBudgetTxns = await getTransactionsForAccount('offbudget-account');
      expect(offBudgetTxns).toHaveLength(0);
    });

    it('should create categorized expense in destination account', async () => {
      await prepareDatabase();

      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000, // -$50.00 expense
        payee: 'payee1',
        notes: 'Groceries',
      });

      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Get transactions in the destination account
      const onBudgetTxns = await getTransactionsForAccount('onbudget-account');
      expect(onBudgetTxns).toHaveLength(2); // Expense + offset

      // Find the categorized expense (negative amount for budget = same as original negative)
      const expenseTxn = onBudgetTxns.find(t => t.category === 'food-cat');
      expect(expenseTxn).toBeTruthy();
      expect(expenseTxn.amount).toBe(-5000); // Same expense amount
      expect(expenseTxn.date).toBe('2024-01-15');
    });

    it('should create offset transactions with Off-Budget Adjustments category', async () => {
      await prepareDatabase();

      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000, // -$50.00 expense
        payee: 'payee1',
      });

      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Get the Off-Budget Adjustments category
      const offBudgetCategory = await db.first<{ id: string }>(
        `SELECT id FROM categories WHERE name = ? AND tombstone = 0`,
        ['Off-Budget Adjustments'],
      );
      expect(offBudgetCategory).toBeTruthy();

      // Get transactions in the destination account
      const onBudgetTxns = await getTransactionsForAccount('onbudget-account');

      // Find the offset transaction
      const offsetTxn = onBudgetTxns.find(
        t => t.category === offBudgetCategory.id,
      );
      expect(offsetTxn).toBeTruthy();
      expect(offsetTxn.amount).toBe(5000); // Opposite of expense (-(-5000) = 5000)
      expect(offsetTxn.notes).toContain('From:');
    });

    it('should handle positive amounts (income/refunds) correctly', async () => {
      await prepareDatabase();

      // Insert a positive transaction (refund)
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: 5000, // +$50.00 refund
        payee: 'payee1',
        notes: 'Refund',
      });

      await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: 'food-cat' }],
      });

      // Get transactions in the destination account
      const onBudgetTxns = await getTransactionsForAccount('onbudget-account');

      // For budget impact: positive amounts become expenses (negative)
      const expenseTxn = onBudgetTxns.find(t => t.category === 'food-cat');
      expect(expenseTxn).toBeTruthy();
      expect(expenseTxn.amount).toBe(-5000); // Positive becomes negative for budget

      // The offset should be the opposite
      const offBudgetCategory = await db.first<{ id: string }>(
        `SELECT id FROM categories WHERE name = ? AND tombstone = 0`,
        ['Off-Budget Adjustments'],
      );
      const offsetTxn = onBudgetTxns.find(
        t => t.category === offBudgetCategory.id,
      );
      expect(offsetTxn).toBeTruthy();
      expect(offsetTxn.amount).toBe(5000); // Offset of the expense
    });

    it('should return error for transactions without category', async () => {
      await prepareDatabase();

      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });

      const result = await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [{ id: 'txn1', categoryId: '' }], // Empty category
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('no category assigned');
    });

    it('should return error for non-existent source account', async () => {
      await prepareDatabase();

      const result = await execute({
        fromAccountId: 'non-existent',
        toAccountId: 'onbudget-account',
        transactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Source account not found');
    });

    it('should return error for non-existent destination account', async () => {
      await prepareDatabase();

      const result = await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'non-existent',
        transactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Destination account not found');
    });

    it('should handle multiple transactions correctly', async () => {
      await prepareDatabase();

      // Insert multiple transactions
      await db.insertTransaction({
        id: 'txn1',
        account: 'offbudget-account',
        date: '2024-01-15',
        amount: -5000,
        payee: 'payee1',
      });
      await db.insertTransaction({
        id: 'txn2',
        account: 'offbudget-account',
        date: '2024-01-16',
        amount: -3000,
        payee: 'payee1',
      });
      await db.insertTransaction({
        id: 'txn3',
        account: 'offbudget-account',
        date: '2024-01-17',
        amount: -2000,
        payee: 'payee1',
      });

      const result = await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [
          { id: 'txn1', categoryId: 'food-cat' },
          { id: 'txn2', categoryId: 'utilities-cat' },
          { id: 'txn3', categoryId: 'food-cat' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(3);

      // All source transactions should be deleted
      const offBudgetTxns = await getTransactionsForAccount('offbudget-account');
      expect(offBudgetTxns).toHaveLength(0);

      // 6 transactions in destination (3 expenses + 3 offsets)
      const onBudgetTxns = await getTransactionsForAccount('onbudget-account');
      expect(onBudgetTxns).toHaveLength(6);
    });

    it('should handle empty transactions array', async () => {
      await prepareDatabase();

      const result = await execute({
        fromAccountId: 'offbudget-account',
        toAccountId: 'onbudget-account',
        transactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
