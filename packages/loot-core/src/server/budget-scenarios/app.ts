import { v4 as uuidv4 } from 'uuid';

import * as monthUtils from '../../shared/months';
import type {
  BudgetScenarioEntity,
  BudgetScenarioDataEntity,
  NewBudgetScenarioEntity,
  ScenarioComparison,
  ScenarioBudgetDiff,
} from '../../types/models';
import { createApp } from '../app';
import * as db from '../db';
import { mutator } from '../mutators';

// Ensure tables exist
let tableInitialized = false;
function ensureTables() {
  if (tableInitialized) return;

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS budget_scenarios
      (id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       description TEXT,
       base_month TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       tombstone INTEGER DEFAULT 0)
  `);

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS budget_scenario_data
      (id TEXT PRIMARY KEY,
       scenario_id TEXT NOT NULL,
       category_id TEXT NOT NULL,
       month TEXT NOT NULL,
       amount INTEGER NOT NULL,
       UNIQUE(scenario_id, category_id, month))
  `);

  tableInitialized = true;
}

export async function createBudgetScenario({
  scenario,
}: {
  scenario: NewBudgetScenarioEntity;
}): Promise<BudgetScenarioEntity['id']> {
  ensureTables();

  const id = uuidv4();
  const now = new Date().toISOString();

  if (!scenario.name) {
    throw new Error('Scenario name is required');
  }

  db.runQuery(
    `INSERT INTO budget_scenarios (id, name, description, base_month, created_at, updated_at, tombstone)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      scenario.name,
      scenario.description || null,
      scenario.base_month || monthUtils.currentMonth(),
      now,
      now,
    ],
  );

  return id;
}

export async function updateBudgetScenario({
  id,
  fields,
}: {
  id: BudgetScenarioEntity['id'];
  fields: Partial<Omit<BudgetScenarioEntity, 'id' | 'tombstone' | 'created_at'>>;
}) {
  ensureTables();

  const updates: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [new Date().toISOString()];

  if (fields.name !== undefined) {
    updates.push('name = ?');
    values.push(fields.name);
  }
  if (fields.description !== undefined) {
    updates.push('description = ?');
    values.push(fields.description || null);
  }
  if (fields.base_month !== undefined) {
    updates.push('base_month = ?');
    values.push(fields.base_month);
  }

  values.push(id);
  db.runQuery(
    `UPDATE budget_scenarios SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function deleteBudgetScenario({
  id,
}: {
  id: BudgetScenarioEntity['id'];
}) {
  ensureTables();

  // Delete scenario data first
  db.runQuery('DELETE FROM budget_scenario_data WHERE scenario_id = ?', [id]);
  // Then soft delete the scenario
  db.runQuery('UPDATE budget_scenarios SET tombstone = 1 WHERE id = ?', [id]);
}

export async function listBudgetScenarios(): Promise<BudgetScenarioEntity[]> {
  ensureTables();

  const rows = db.runQuery<BudgetScenarioEntity>(
    'SELECT * FROM budget_scenarios WHERE tombstone = 0 ORDER BY updated_at DESC',
    [],
    true,
  );

  return rows.map(row => ({
    ...row,
    tombstone: row.tombstone ? 1 : 0,
  }));
}

export async function getBudgetScenario({
  id,
}: {
  id: BudgetScenarioEntity['id'];
}): Promise<BudgetScenarioEntity | null> {
  ensureTables();

  const rows = db.runQuery<BudgetScenarioEntity>(
    'SELECT * FROM budget_scenarios WHERE id = ? AND tombstone = 0',
    [id],
    true,
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    tombstone: rows[0].tombstone ? 1 : 0,
  };
}

/**
 * Clone current budget data into a new scenario
 */
export async function cloneBudgetToScenario({
  name,
  description,
  month,
}: {
  name: string;
  description?: string;
  month?: string;
}): Promise<BudgetScenarioEntity['id']> {
  ensureTables();

  const targetMonth = month || monthUtils.currentMonth();

  // Create the scenario
  const scenarioId = await createBudgetScenario({
    scenario: {
      name,
      description,
      base_month: targetMonth,
    },
  });

  // Get budget type
  const budgetType = db.runQuery<{ value: string }>(
    `SELECT value FROM preferences WHERE id = 'budgetType'`,
    [],
    true,
  );

  const tableName =
    budgetType[0]?.value === 'tracking' ? 'reflect_budgets' : 'zero_budgets';

  // Convert month format: 'YYYY-MM' -> YYYYMM (integer) for budget table query
  const dbMonth = parseInt(targetMonth.replace('-', ''));

  // Clone budget data for the target month
  const budgetRows = db.runQuery<{ category: string; amount: number }>(
    `SELECT category, amount FROM ${tableName} WHERE month = ?`,
    [dbMonth],
    true,
  );

  console.log('[Clone Scenario] Cloning from', tableName, 'month:', dbMonth, 'rows:', budgetRows.length);

  // Insert scenario data
  for (const row of budgetRows) {
    if (row.category && row.amount !== undefined) {
      db.runQuery(
        `INSERT INTO budget_scenario_data (id, scenario_id, category_id, month, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), scenarioId, row.category, targetMonth, row.amount],
      );
    }
  }

  return scenarioId;
}

/**
 * Get scenario budget data
 */
export async function getScenarioBudgetData({
  scenarioId,
  month,
}: {
  scenarioId: BudgetScenarioEntity['id'];
  month?: string;
}): Promise<BudgetScenarioDataEntity[]> {
  ensureTables();

  let query = 'SELECT * FROM budget_scenario_data WHERE scenario_id = ?';
  const params: string[] = [scenarioId];

  if (month) {
    query += ' AND month = ?';
    params.push(month);
  }

  return db.runQuery<BudgetScenarioDataEntity>(query, params, true);
}

/**
 * Update a budget value in a scenario
 */
export async function updateScenarioBudget({
  scenarioId,
  categoryId,
  month,
  amount,
}: {
  scenarioId: BudgetScenarioEntity['id'];
  categoryId: string;
  month: string;
  amount: number;
}) {
  ensureTables();

  // Check if entry exists
  const existing = db.runQuery(
    `SELECT 1 FROM budget_scenario_data WHERE scenario_id = ? AND category_id = ? AND month = ?`,
    [scenarioId, categoryId, month],
    true,
  );

  if (existing.length > 0) {
    db.runQuery(
      `UPDATE budget_scenario_data SET amount = ? WHERE scenario_id = ? AND category_id = ? AND month = ?`,
      [amount, scenarioId, categoryId, month],
    );
  } else {
    db.runQuery(
      `INSERT INTO budget_scenario_data (id, scenario_id, category_id, month, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), scenarioId, categoryId, month, amount],
    );
  }

  // Update scenario timestamp
  db.runQuery(
    'UPDATE budget_scenarios SET updated_at = ? WHERE id = ?',
    [new Date().toISOString(), scenarioId],
  );
}

/**
 * Compare a scenario with the current budget
 */
export async function compareScenarioWithCurrent({
  scenarioId,
  month,
}: {
  scenarioId: BudgetScenarioEntity['id'];
  month?: string;
}): Promise<ScenarioComparison | null> {
  ensureTables();

  const scenario = await getBudgetScenario({ id: scenarioId });
  if (!scenario) {
    console.log('[Scenario Compare] Scenario not found:', scenarioId);
    return null;
  }

  const targetMonth = month || scenario.base_month;
  console.log('[Scenario Compare] Comparing scenario:', scenario.name, 'for month:', targetMonth);

  // Get budget type
  const budgetType = db.runQuery<{ value: string }>(
    `SELECT value FROM preferences WHERE id = 'budgetType'`,
    [],
    true,
  );

  const tableName =
    budgetType[0]?.value === 'tracking' ? 'reflect_budgets' : 'zero_budgets';

  // Convert month formats: 'YYYY-MM' -> YYYYMM (integer)
  const dbMonth = parseInt(targetMonth.replace('-', ''));
  const scenarioBaseDbMonth = parseInt(scenario.base_month.replace('-', ''));

  console.log('[Scenario Compare] Budget table:', tableName);
  console.log('[Scenario Compare] Current budget month:', targetMonth, '(', dbMonth, ')');
  console.log('[Scenario Compare] Scenario base month:', scenario.base_month, '(', scenarioBaseDbMonth, ')');

  // Get current budget data for the SELECTED month
  const currentBudget = db.runQuery<{ category: string; amount: number }>(
    `SELECT category, amount FROM ${tableName} WHERE month = ?`,
    [dbMonth],
    true,
  );

  console.log('[Scenario Compare] Current budget rows:', currentBudget.length, currentBudget.slice(0, 3));

  // Get scenario budget data for the SCENARIO'S BASE MONTH (not the selected month)
  // The scenario is a snapshot of a specific month's budget
  let scenarioBudget = db.runQuery<{ category_id: string; amount: number }>(
    `SELECT category_id, amount FROM budget_scenario_data WHERE scenario_id = ? AND month = ?`,
    [scenarioId, scenario.base_month],
    true,
  );

  // If no results, try integer format (for backward compatibility)
  if (scenarioBudget.length === 0) {
    scenarioBudget = db.runQuery<{ category_id: string; amount: number }>(
      `SELECT category_id, amount FROM budget_scenario_data WHERE scenario_id = ? AND month = ?`,
      [scenarioId, String(scenarioBaseDbMonth)],
      true,
    );
  }

  console.log('[Scenario Compare] Scenario budget rows:', scenarioBudget.length, scenarioBudget.slice(0, 3));

  // Check if scenario has ANY data at all
  const allScenarioData = db.runQuery<{ month: string; count: number }>(
    `SELECT month, COUNT(*) as count FROM budget_scenario_data WHERE scenario_id = ? GROUP BY month`,
    [scenarioId],
    true,
  );
  console.log('[Scenario Compare] All scenario data by month:', allScenarioData);

  // Get category names
  const categories = db.runQuery<{ id: string; name: string }>(
    'SELECT id, name FROM categories WHERE tombstone = 0',
    [],
    true,
  );

  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const currentMap = new Map(currentBudget.map(b => [b.category, b.amount]));
  const scenarioMap = new Map(scenarioBudget.map(b => [b.category_id, b.amount]));

  // Build differences
  const allCategoryIds = new Set([
    ...currentMap.keys(),
    ...scenarioMap.keys(),
  ]);

  const differences: ScenarioBudgetDiff[] = [];
  let totalCurrent = 0;
  let totalScenario = 0;

  for (const categoryId of allCategoryIds) {
    const currentAmount = currentMap.get(categoryId) || 0;
    const scenarioAmount = scenarioMap.get(categoryId) || 0;
    const difference = scenarioAmount - currentAmount;

    totalCurrent += currentAmount;
    totalScenario += scenarioAmount;

    if (difference !== 0) {
      differences.push({
        category_id: categoryId,
        category_name: categoryMap.get(categoryId) || 'Unknown',
        current_amount: currentAmount,
        scenario_amount: scenarioAmount,
        difference,
        percentage_change:
          currentAmount !== 0
            ? Math.round((difference / Math.abs(currentAmount)) * 100)
            : scenarioAmount !== 0
              ? 100
              : 0,
      });
    }
  }

  // Sort by absolute difference (largest first)
  differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return {
    scenario,
    month: targetMonth,
    total_current: totalCurrent,
    total_scenario: totalScenario,
    total_difference: totalScenario - totalCurrent,
    differences,
  };
}

/**
 * Compare multiple months - showing budgeted, actual expenses, and income
 */
export type MonthSummary = {
  month: string;
  income_budgeted: number;
  income_actual: number;
  expenses_budgeted: number;
  expenses_actual: number;
  net_budgeted: number; // income - expenses budgeted
  net_actual: number; // income - expenses actual
  savings_rate: number; // (income_actual - expenses_actual) / income_actual * 100
};

export type MultiMonthComparison = {
  months: MonthSummary[];
  best_month: string | null; // month with highest net_actual (most productive)
  worst_month: string | null; // month with lowest net_actual
  average_expenses: number;
  average_income: number;
};

export async function compareMultipleMonths({
  months,
}: {
  months: string[];
}): Promise<MultiMonthComparison> {
  ensureTables();

  // Get budget type to determine which table to query
  const budgetType = db.runQuery<{ value: string }>(
    `SELECT value FROM preferences WHERE id = 'budgetType'`,
    [],
    true,
  );
  const budgetTable =
    budgetType[0]?.value === 'tracking' ? 'reflect_budgets' : 'zero_budgets';

  console.log('[Budget Analysis] Budget type:', budgetType[0]?.value, '-> table:', budgetTable);
  console.log('[Budget Analysis] Analyzing months:', months);

  const summaries: MonthSummary[] = [];

  for (const month of months) {
    // Convert month format: 'YYYY-MM' -> YYYYMM (integer) for budget table query
    const dbMonth = parseInt(month.replace('-', ''));

    // Query budgeted amounts directly from budget table
    // Use INNER JOIN to only get categories that exist
    const budgetData = db.runQuery<{
      category: string;
      amount: number;
      is_income: number;
    }>(
      `SELECT b.category, b.amount, COALESCE(c.is_income, 0) as is_income
       FROM ${budgetTable} b
       LEFT JOIN categories c ON c.id = b.category
       WHERE b.month = ? AND (c.tombstone = 0 OR c.tombstone IS NULL)`,
      [dbMonth],
      true,
    );

    console.log(`[Budget Analysis] Month ${month} (dbMonth: ${dbMonth}) - Budget rows:`, budgetData.length, budgetData.slice(0, 3));

    // Query actual transactions - convert month to date range
    const startDate = parseInt(monthUtils.firstDayOfMonth(month).replace(/-/g, ''));
    const endDate = parseInt(monthUtils.lastDayOfMonth(month).replace(/-/g, ''));

    console.log(`[Budget Analysis] Month ${month} - Date range: ${startDate} to ${endDate}`);

    // First, let's see ALL transactions for this month (without filters)
    const allTransactions = db.runQuery<{ count: number; total: number }>(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM transactions t
       WHERE t.date >= ? AND t.date <= ?
         AND t.tombstone = 0`,
      [startDate, endDate],
      true,
    );
    console.log(`[Budget Analysis] Month ${month} - All transactions:`, allTransactions[0]);

    // Check accounts
    const accountInfo = db.runQuery<{ id: string; name: string; offbudget: number }>(
      `SELECT DISTINCT a.id, a.name, a.offbudget
       FROM transactions t
       JOIN accounts a ON a.id = t.acct
       WHERE t.date >= ? AND t.date <= ?
         AND t.tombstone = 0`,
      [startDate, endDate],
      true,
    );
    console.log(`[Budget Analysis] Month ${month} - Accounts used:`, accountInfo);

    // Now query with full filters but more permissive on categories
    const transactionData = db.runQuery<{
      category: string;
      total: number;
      is_income: number;
    }>(
      `SELECT t.category, SUM(t.amount) as total, COALESCE(c.is_income, 0) as is_income
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category
       LEFT JOIN accounts a ON a.id = t.acct
       WHERE t.date >= ? AND t.date <= ?
         AND t.tombstone = 0
         AND t.isParent = 0
         AND (a.offbudget = 0 OR a.offbudget IS NULL)
         AND (c.tombstone = 0 OR c.tombstone IS NULL OR t.category IS NULL)
       GROUP BY t.category`,
      [startDate, endDate],
      true,
    );

    console.log(`[Budget Analysis] Month ${month} - Filtered transactions:`, transactionData.length, transactionData.slice(0, 5));

    // Calculate totals
    let income_budgeted = 0;
    let expenses_budgeted = 0;
    let income_actual = 0;
    let expenses_actual = 0;

    for (const row of budgetData) {
      if (row.is_income === 1) {
        income_budgeted += row.amount || 0;
      } else {
        expenses_budgeted += Math.abs(row.amount || 0);
      }
    }

    for (const row of transactionData) {
      // Skip uncategorized transactions for now (category is NULL)
      if (!row.category) {
        console.log(`[Budget Analysis] Uncategorized transactions total:`, row.total);
        continue;
      }
      if (row.is_income === 1) {
        income_actual += Math.abs(row.total || 0);
      } else {
        expenses_actual += Math.abs(row.total || 0);
      }
    }

    console.log(`[Budget Analysis] Month ${month} - Results: income_actual=${income_actual}, expenses_actual=${expenses_actual}`);

    const net_budgeted = income_budgeted - expenses_budgeted;
    const net_actual = income_actual - expenses_actual;
    const savings_rate = income_actual > 0
      ? Math.round((net_actual / income_actual) * 100)
      : 0;

    summaries.push({
      month,
      income_budgeted,
      income_actual,
      expenses_budgeted,
      expenses_actual,
      net_budgeted,
      net_actual,
      savings_rate,
    });
  }

  // Find best and worst months
  let best_month: string | null = null;
  let worst_month: string | null = null;
  let best_net = -Infinity;
  let worst_net = Infinity;
  let total_expenses = 0;
  let total_income = 0;

  for (const summary of summaries) {
    if (summary.net_actual > best_net) {
      best_net = summary.net_actual;
      best_month = summary.month;
    }
    if (summary.net_actual < worst_net) {
      worst_net = summary.net_actual;
      worst_month = summary.month;
    }
    total_expenses += summary.expenses_actual;
    total_income += summary.income_actual;
  }

  const average_expenses = summaries.length > 0
    ? Math.round(total_expenses / summaries.length)
    : 0;
  const average_income = summaries.length > 0
    ? Math.round(total_income / summaries.length)
    : 0;

  return {
    months: summaries,
    best_month,
    worst_month,
    average_expenses,
    average_income,
  };
}

export type BudgetScenariosHandlers = {
  'budget-scenario/create': typeof createBudgetScenario;
  'budget-scenario/update': typeof updateBudgetScenario;
  'budget-scenario/delete': typeof deleteBudgetScenario;
  'budget-scenario/list': typeof listBudgetScenarios;
  'budget-scenario/get': typeof getBudgetScenario;
  'budget-scenario/clone-current': typeof cloneBudgetToScenario;
  'budget-scenario/get-data': typeof getScenarioBudgetData;
  'budget-scenario/update-budget': typeof updateScenarioBudget;
  'budget-scenario/compare': typeof compareScenarioWithCurrent;
  'budget-scenario/compare-months': typeof compareMultipleMonths;
};

export const app = createApp<BudgetScenariosHandlers>();

app.method('budget-scenario/create', mutator(createBudgetScenario));
app.method('budget-scenario/update', mutator(updateBudgetScenario));
app.method('budget-scenario/delete', mutator(deleteBudgetScenario));
app.method('budget-scenario/list', listBudgetScenarios);
app.method('budget-scenario/get', getBudgetScenario);
app.method('budget-scenario/clone-current', mutator(cloneBudgetToScenario));
app.method('budget-scenario/get-data', getScenarioBudgetData);
app.method('budget-scenario/update-budget', mutator(updateScenarioBudget));
app.method('budget-scenario/compare', compareScenarioWithCurrent);
app.method('budget-scenario/compare-months', compareMultipleMonths);
