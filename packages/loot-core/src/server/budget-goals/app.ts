import { v4 as uuidv4 } from 'uuid';

import * as monthUtils from '../../shared/months';
import type {
  BudgetGoalEntity,
  BudgetGoalProgress,
  BudgetGoalType,
  NewBudgetGoalEntity,
} from '../../types/models';
import { createApp } from '../app';
import * as db from '../db';
import { mutator } from '../mutators';

// Ensure the budget_goals table exists
let tableInitialized = false;
function ensureTable() {
  if (tableInitialized) return;

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS budget_goals
      (id TEXT PRIMARY KEY,
       category_id TEXT NOT NULL,
       goal_type TEXT NOT NULL,
       target_amount INTEGER NOT NULL,
       target_date TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       tombstone INTEGER DEFAULT 0)
  `);
  tableInitialized = true;
}

export async function createBudgetGoal({
  goal,
}: {
  goal: NewBudgetGoalEntity;
}): Promise<BudgetGoalEntity['id']> {
  ensureTable();

  const id = uuidv4();
  const now = new Date().toISOString();

  if (!goal.category_id) {
    throw new Error('Category ID is required');
  }

  if (!goal.goal_type) {
    throw new Error('Goal type is required');
  }

  if (goal.target_amount === undefined || goal.target_amount === null) {
    throw new Error('Target amount is required');
  }

  // Validate goal type
  const validGoalTypes: BudgetGoalType[] = ['savings', 'spending-limit', 'target-balance'];
  if (!validGoalTypes.includes(goal.goal_type)) {
    throw new Error(`Invalid goal type: ${goal.goal_type}`);
  }

  db.runQuery(
    `INSERT INTO budget_goals (id, category_id, goal_type, target_amount, target_date, created_at, updated_at, tombstone)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, goal.category_id, goal.goal_type, goal.target_amount, goal.target_date || null, now, now],
  );

  return id;
}

export async function updateBudgetGoal({
  id,
  fields,
}: {
  id: BudgetGoalEntity['id'];
  fields: Partial<Omit<BudgetGoalEntity, 'id' | 'tombstone' | 'created_at'>>;
}) {
  ensureTable();

  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [new Date().toISOString()];

  if (fields.goal_type !== undefined) {
    updates.push('goal_type = ?');
    values.push(fields.goal_type);
  }
  if (fields.target_amount !== undefined) {
    updates.push('target_amount = ?');
    values.push(fields.target_amount);
  }
  if (fields.target_date !== undefined) {
    updates.push('target_date = ?');
    values.push(fields.target_date || null);
  }

  values.push(id);
  db.runQuery(
    `UPDATE budget_goals SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function deleteBudgetGoal({
  id,
}: {
  id: BudgetGoalEntity['id'];
}) {
  ensureTable();
  db.runQuery('UPDATE budget_goals SET tombstone = 1 WHERE id = ?', [id]);
}

export async function listBudgetGoals(): Promise<BudgetGoalEntity[]> {
  ensureTable();

  const rows = db.runQuery<BudgetGoalEntity>(
    'SELECT * FROM budget_goals WHERE tombstone = 0 ORDER BY created_at DESC',
    [],
    true,
  );

  return rows.map(row => ({
    ...row,
    tombstone: row.tombstone ? 1 : 0,
  }));
}

export async function getBudgetGoal({
  id,
}: {
  id: BudgetGoalEntity['id'];
}): Promise<BudgetGoalEntity | null> {
  ensureTable();

  const rows = db.runQuery<BudgetGoalEntity>(
    'SELECT * FROM budget_goals WHERE id = ? AND tombstone = 0',
    [id],
    true,
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    tombstone: rows[0].tombstone ? 1 : 0,
  };
}

export async function getBudgetGoalForCategory({
  categoryId,
}: {
  categoryId: string;
}): Promise<BudgetGoalEntity | null> {
  ensureTable();

  const rows = db.runQuery<BudgetGoalEntity>(
    'SELECT * FROM budget_goals WHERE category_id = ? AND tombstone = 0 ORDER BY created_at DESC LIMIT 1',
    [categoryId],
    true,
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    tombstone: rows[0].tombstone ? 1 : 0,
  };
}

/**
 * Get goal progress for a category
 */
export async function getBudgetGoalProgress({
  categoryId,
  month,
}: {
  categoryId: string;
  month?: string;
}): Promise<BudgetGoalProgress | null> {
  ensureTable();

  const goal = await getBudgetGoalForCategory({ categoryId });
  if (!goal) return null;

  const targetMonth = month || monthUtils.currentMonth();

  // Get current category balance
  const budgetType = db.runQuery<{ value: string }>(
    `SELECT value FROM preferences WHERE id = 'budgetType'`,
    [],
    true,
  );

  const tableName =
    budgetType[0]?.value === 'tracking' ? 'reflect_budgets' : 'zero_budgets';

  // Get the budget amount for this category/month
  const budgetRows = db.runQuery<{ amount: number }>(
    `SELECT amount FROM ${tableName} WHERE category = ? AND month = ?`,
    [categoryId, targetMonth],
    true,
  );

  // Get spent amount for this category/month
  const spentRows = db.runQuery<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM v_transactions_internal
     WHERE category = ? AND date >= ? AND date <= ?`,
    [categoryId, targetMonth + '-01', monthUtils.getDay(monthUtils.lastDayOfMonth(targetMonth))],
    true,
  );

  const budgeted = budgetRows[0]?.amount || 0;
  const spent = spentRows[0]?.total || 0;
  const balance = budgeted + spent; // spent is negative

  let currentAmount = 0;
  let progressPercentage = 0;
  let isAchieved = false;
  let monthsRemaining: number | undefined;
  let monthlyContribution: number | undefined;

  switch (goal.goal_type) {
    case 'savings': {
      // For savings, current amount is the positive balance accumulated
      currentAmount = Math.max(0, balance);
      progressPercentage = goal.target_amount > 0
        ? Math.round((currentAmount / goal.target_amount) * 100)
        : 0;
      isAchieved = currentAmount >= goal.target_amount;

      // Calculate months remaining and required contribution
      if (goal.target_date && !isAchieved) {
        monthsRemaining = monthUtils.differenceInCalendarMonths(
          monthUtils.parseDate(goal.target_date + '-01'),
          monthUtils.parseDate(targetMonth + '-01'),
        );
        if (monthsRemaining > 0) {
          const remaining = goal.target_amount - currentAmount;
          monthlyContribution = Math.ceil(remaining / monthsRemaining);
        }
      }
      break;
    }
    case 'spending-limit': {
      // For spending limits, current amount is how much has been spent (absolute value)
      currentAmount = Math.abs(spent);
      progressPercentage = goal.target_amount > 0
        ? Math.round((currentAmount / goal.target_amount) * 100)
        : 0;
      // Goal is achieved if spending is under the limit
      isAchieved = currentAmount <= goal.target_amount;
      break;
    }
    case 'target-balance': {
      // For target balance, current amount is the current balance
      currentAmount = balance;
      progressPercentage = goal.target_amount > 0
        ? Math.round((currentAmount / goal.target_amount) * 100)
        : 0;
      isAchieved = currentAmount >= goal.target_amount;
      break;
    }
  }

  return {
    ...goal,
    current_amount: currentAmount,
    progress_percentage: progressPercentage,
    is_achieved: isAchieved,
    months_remaining: monthsRemaining,
    monthly_contribution: monthlyContribution,
  };
}

export type BudgetGoalsHandlers = {
  'budget-goal/create': typeof createBudgetGoal;
  'budget-goal/update': typeof updateBudgetGoal;
  'budget-goal/delete': typeof deleteBudgetGoal;
  'budget-goal/list': typeof listBudgetGoals;
  'budget-goal/get': typeof getBudgetGoal;
  'budget-goal/get-for-category': typeof getBudgetGoalForCategory;
  'budget-goal/get-progress': typeof getBudgetGoalProgress;
};

export const app = createApp<BudgetGoalsHandlers>();

app.method('budget-goal/create', mutator(createBudgetGoal));
app.method('budget-goal/update', mutator(updateBudgetGoal));
app.method('budget-goal/delete', mutator(deleteBudgetGoal));
app.method('budget-goal/list', listBudgetGoals);
app.method('budget-goal/get', getBudgetGoal);
app.method('budget-goal/get-for-category', getBudgetGoalForCategory);
app.method('budget-goal/get-progress', getBudgetGoalProgress);
