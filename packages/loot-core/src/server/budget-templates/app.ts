import { v4 as uuidv4 } from 'uuid';

import * as monthUtils from '../../shared/months';
import type {
  BudgetTemplateEntity,
  BudgetTemplateData,
  NewBudgetTemplateEntity,
} from '../../types/models';
import { createApp } from '../app';
import { setBudget } from '../budget/actions';
import * as db from '../db';
import { mutator } from '../mutators';

// Ensure the budget_templates table exists
let tableInitialized = false;
function ensureTable() {
  if (tableInitialized) return;

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS budget_templates
      (id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       description TEXT,
       data TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       tombstone INTEGER DEFAULT 0)
  `);
  tableInitialized = true;
}

export async function createBudgetTemplate({
  template,
}: {
  template: NewBudgetTemplateEntity;
}): Promise<BudgetTemplateEntity['id']> {
  ensureTable();

  const id = uuidv4();
  const now = new Date().toISOString();

  if (!template.name) {
    throw new Error('Template name is required');
  }

  if (!template.data) {
    throw new Error('Template data is required');
  }

  db.runQuery(
    `INSERT INTO budget_templates (id, name, description, data, created_at, updated_at, tombstone)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, template.name, template.description || null, template.data, now, now],
  );

  return id;
}

export async function updateBudgetTemplate({
  id,
  fields,
}: {
  id: BudgetTemplateEntity['id'];
  fields: Partial<Omit<BudgetTemplateEntity, 'id' | 'tombstone' | 'created_at'>>;
}) {
  ensureTable();

  const updates: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [new Date().toISOString()];

  if (fields.name !== undefined) {
    updates.push('name = ?');
    values.push(fields.name);
  }
  if (fields.description !== undefined) {
    updates.push('description = ?');
    values.push(fields.description);
  }
  if (fields.data !== undefined) {
    updates.push('data = ?');
    values.push(fields.data);
  }

  values.push(id);
  db.runQuery(
    `UPDATE budget_templates SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function deleteBudgetTemplate({
  id,
}: {
  id: BudgetTemplateEntity['id'];
}) {
  ensureTable();
  db.runQuery('UPDATE budget_templates SET tombstone = 1 WHERE id = ?', [id]);
}

export async function listBudgetTemplates(): Promise<BudgetTemplateEntity[]> {
  ensureTable();

  const rows = db.runQuery<BudgetTemplateEntity>(
    'SELECT * FROM budget_templates WHERE tombstone = 0 ORDER BY updated_at DESC',
    [],
    true,
  );

  return rows.map(row => ({
    ...row,
    tombstone: row.tombstone ? 1 : 0,
  }));
}

export async function getBudgetTemplate({
  id,
}: {
  id: BudgetTemplateEntity['id'];
}): Promise<BudgetTemplateEntity | null> {
  ensureTable();

  const rows = db.runQuery<BudgetTemplateEntity>(
    'SELECT * FROM budget_templates WHERE id = ? AND tombstone = 0',
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
 * Save the current month's budget as a template
 */
export async function saveCurrentBudgetAsTemplate({
  name,
  description,
  month,
}: {
  name: string;
  description?: string;
  month?: string;
}): Promise<BudgetTemplateEntity['id']> {
  ensureTable();

  const targetMonth = month || monthUtils.currentMonth();
  // Convert month format: 'YYYY-MM' -> YYYYMM (integer) for budget table query
  const dbMonth = parseInt(targetMonth.replace('-', ''));

  // Get valid (non-deleted) category IDs
  const validCategories = db.runQuery<{ id: string }>(
    `SELECT id FROM categories WHERE tombstone = 0`,
    [],
    true,
  );
  const validCategoryIds = new Set(validCategories.map(c => c.id));

  // Get all category budgets for the specified month
  const budgetRows = db.runQuery<{ category: string; amount: number }>(
    `SELECT category, amount FROM zero_budgets WHERE month = ?`,
    [dbMonth],
    true,
  );

  // Also check if using envelope budgeting
  const envelopeRows = db.runQuery<{ category: string; amount: number }>(
    `SELECT category, amount FROM reflect_budgets WHERE month = ?`,
    [dbMonth],
    true,
  );

  const categories: Record<string, number> = {};

  // Combine both budget types (one will typically be empty)
  // Include ALL valid (non-deleted) categories, even those with 0 amount
  // This ensures when applying, we also set categories to 0 if they were 0
  for (const row of [...budgetRows, ...envelopeRows]) {
    if (row.category && validCategoryIds.has(row.category)) {
      categories[row.category] = row.amount || 0;
    }
  }

  console.log('[Budget Template] Saving template with', Object.keys(categories).length, 'categories');

  const templateData: BudgetTemplateData = {
    categories,
    sourceMonth: targetMonth,
  };

  return createBudgetTemplate({
    template: {
      name,
      description,
      data: JSON.stringify(templateData),
    },
  });
}

/**
 * Apply a template to a specific month
 */
export async function applyBudgetTemplate({
  id,
  month,
}: {
  id: BudgetTemplateEntity['id'];
  month?: string;
}): Promise<void> {
  ensureTable();

  const template = await getBudgetTemplate({ id });
  if (!template) {
    throw new Error('Template not found');
  }

  const targetMonth = month || monthUtils.currentMonth();
  const currentMonth = monthUtils.currentMonth();

  // Validate that target month is not in the past
  if (targetMonth < currentMonth) {
    throw new Error('Cannot apply template to past months');
  }

  const templateData: BudgetTemplateData = JSON.parse(template.data);

  // Get valid (non-deleted) category IDs
  const validCategories = db.runQuery<{ id: string }>(
    `SELECT id FROM categories WHERE tombstone = 0`,
    [],
    true,
  );
  const validCategoryIds = new Set(validCategories.map(c => c.id));

  console.log('[Budget Template] Applying template to month:', targetMonth);
  console.log('[Budget Template] Template has', Object.keys(templateData.categories).length, 'categories');
  console.log('[Budget Template] Valid categories in DB:', validCategoryIds.size);

  // Apply each category budget using the proper setBudget function
  // This ensures sync and spreadsheet updates are triggered
  // Only apply to categories that still exist
  let appliedCount = 0;
  for (const [categoryId, amount] of Object.entries(templateData.categories)) {
    if (validCategoryIds.has(categoryId)) {
      await setBudget({
        category: categoryId,
        month: targetMonth,
        amount: amount,
      });
      appliedCount++;
    } else {
      console.log('[Budget Template] Skipping deleted category:', categoryId);
    }
  }

  console.log('[Budget Template] Applied', appliedCount, 'categories successfully');
}

export type BudgetTemplatesHandlers = {
  'budget-template/create': typeof createBudgetTemplate;
  'budget-template/update': typeof updateBudgetTemplate;
  'budget-template/delete': typeof deleteBudgetTemplate;
  'budget-template/list': typeof listBudgetTemplates;
  'budget-template/get': typeof getBudgetTemplate;
  'budget-template/save-current': typeof saveCurrentBudgetAsTemplate;
  'budget-template/apply': typeof applyBudgetTemplate;
};

export const app = createApp<BudgetTemplatesHandlers>();

app.method('budget-template/create', mutator(createBudgetTemplate));
app.method('budget-template/update', mutator(updateBudgetTemplate));
app.method('budget-template/delete', mutator(deleteBudgetTemplate));
app.method('budget-template/list', listBudgetTemplates);
app.method('budget-template/get', getBudgetTemplate);
app.method('budget-template/save-current', mutator(saveCurrentBudgetAsTemplate));
app.method('budget-template/apply', mutator(applyBudgetTemplate));
