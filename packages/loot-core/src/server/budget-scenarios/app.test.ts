// @ts-strict-ignore
import * as monthUtils from '../../shared/months';
import { getSheetValue } from '../budget/actions';
import { createAllBudgets } from '../budget/base';
import * as db from '../db';
import * as sheet from '../sheet';

import { compareMultipleMonths } from './app';

beforeEach(() => {
  return global.emptyDatabase()();
});

describe('Budget Scenarios - compareMultipleMonths', () => {
  it('should return data for months with transactions', async () => {
    await sheet.loadSpreadsheet(db);

    // Create category groups
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });

    // Create categories
    const expenseCatId = await db.insertCategory({
      name: 'Food',
      cat_group: 'group1',
    });

    const incomeCatId = await db.insertCategory({
      name: 'Salary',
      cat_group: 'income-group',
      is_income: 1,
    });

    // Create account
    await db.insertAccount({ id: 'account1', name: 'Checking' });

    const month = '2017-01';  // Use a date that createAllBudgets will include
    const sheetName = monthUtils.sheetForMonth(month);

    // Insert transactions BEFORE creating budgets
    // (so createAllBudgets knows what date range to cover)
    await db.insertTransaction({
      date: '2017-01-15',
      amount: -50000, // -500.00 expense
      account: 'account1',
      category: expenseCatId,
    });

    await db.insertTransaction({
      date: '2017-01-10',
      amount: 100000, // +1000.00 income
      account: 'account1',
      category: incomeCatId,
    });

    // Create budgets AFTER inserting transactions
    await createAllBudgets();

    // Wait for spreadsheet to process
    await sheet.waitOnSpreadsheet();

    // Debug: Check what the spreadsheet has using different methods
    const sumAmountExpenseDirect = sheet.getCellValue(sheetName, `sum-amount-${expenseCatId}`);
    const sumAmountIncomeDirect = sheet.getCellValue(sheetName, `sum-amount-${incomeCatId}`);
    const sumAmountExpenseAction = await getSheetValue(sheetName, `sum-amount-${expenseCatId}`);
    const sumAmountIncomeAction = await getSheetValue(sheetName, `sum-amount-${incomeCatId}`);

    console.log('DEBUG - Sheet name:', sheetName);
    console.log('DEBUG - Expense category ID:', expenseCatId);
    console.log('DEBUG - Income category ID:', incomeCatId);
    console.log('DEBUG - Direct getCellValue:');
    console.log('  Expense sum-amount:', sumAmountExpenseDirect);
    console.log('  Income sum-amount:', sumAmountIncomeDirect);
    console.log('DEBUG - getSheetValue (from actions):');
    console.log('  Expense sum-amount:', sumAmountExpenseAction);
    console.log('  Income sum-amount:', sumAmountIncomeAction);

    // Check categories in DB
    const categories = db.runQuery(
      'SELECT id, name, is_income FROM categories WHERE tombstone = 0',
      [],
      true,
    );
    console.log('DEBUG - Categories in DB:', categories);

    // Call the function
    const result = await compareMultipleMonths({ months: [month] });

    console.log('DEBUG - compareMultipleMonths result:', JSON.stringify(result, null, 2));

    // Verify the result
    expect(result).not.toBeNull();
    expect(result.months).toHaveLength(1);

    const monthData = result.months[0];
    expect(monthData.month).toBe('2017-01');

    // Check that we got actual data (not zeros)
    // Throw the debug info if expenses_actual is 0
    if (monthData.expenses_actual === 0) {
      throw new Error(`DEBUG INFO:
        sheetName: ${sheetName}
        expenseCatId: ${expenseCatId}
        incomeCatId: ${incomeCatId}
        Direct getCellValue expense: ${sumAmountExpenseDirect}
        Direct getCellValue income: ${sumAmountIncomeDirect}
        getSheetValue expense: ${sumAmountExpenseAction}
        getSheetValue income: ${sumAmountIncomeAction}
        Categories: ${JSON.stringify(categories)}
        Result: ${JSON.stringify(result, null, 2)}
      `);
    }

    // The expense should be 50000 (500.00)
    expect(monthData.expenses_actual).toBe(50000);

    // The income should be 100000 (1000.00)
    expect(monthData.income_actual).toBe(100000);

    // Net should be income - expenses = 50000
    expect(monthData.net_actual).toBe(50000);
  });

  it('should identify best and worst months', async () => {
    await sheet.loadSpreadsheet(db);

    // Create category groups
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });

    // Create categories
    const expenseCatId = await db.insertCategory({
      name: 'Food',
      cat_group: 'group1',
    });

    const incomeCatId = await db.insertCategory({
      name: 'Salary',
      cat_group: 'income-group',
      is_income: 1,
    });

    // Create account
    await db.insertAccount({ id: 'account1', name: 'Checking' });

    // Insert transactions BEFORE creating budgets
    // Month 1: High income, low expenses (good month)
    await db.insertTransaction({
      date: '2017-01-15',
      amount: -20000, // -200.00 expense
      account: 'account1',
      category: expenseCatId,
    });
    await db.insertTransaction({
      date: '2017-01-10',
      amount: 100000, // +1000.00 income
      account: 'account1',
      category: incomeCatId,
    });

    // Month 2: Low income, high expenses (bad month)
    await db.insertTransaction({
      date: '2017-02-15',
      amount: -80000, // -800.00 expense
      account: 'account1',
      category: expenseCatId,
    });
    await db.insertTransaction({
      date: '2017-02-10',
      amount: 50000, // +500.00 income
      account: 'account1',
      category: incomeCatId,
    });

    // Create budgets AFTER inserting transactions
    await createAllBudgets();

    // Wait for spreadsheet to process
    await sheet.waitOnSpreadsheet();

    // Call the function
    const result = await compareMultipleMonths({ months: ['2017-01', '2017-02'] });

    // Best month should be January (net = 800)
    expect(result.best_month).toBe('2017-01');

    // Worst month should be February (net = -300)
    expect(result.worst_month).toBe('2017-02');
  });
});
