import * as monthUtils from '../../shared/months';
import { q } from '../../shared/query';
import type {
  BudgetComparison,
  ForecastCategoryBreakdown,
} from '../../types/models';
import { aqlQuery } from '../aql';
import * as sheet from '../sheet';
import { resolveName } from '../spreadsheet/util';

// Get budget amounts for a range of months
// forecastedAmounts is the TOTAL across all months in the forecast period
// We need to sum budgets across all months to compare apples to apples
export async function getBudgetForPeriod(
  startMonth: string,
  endMonth: string,
  forecastedAmounts: Record<string, number>,
  categoryBreakdown: ForecastCategoryBreakdown[],
): Promise<BudgetComparison[]> {
  const result: BudgetComparison[] = [];

  // Get all categories
  const { data: categories } = await aqlQuery(
    q('categories').select(['id', 'name', 'is_income']),
  );

  if (!categories || categories.length === 0) {
    return result;
  }

  // Filter to expense categories only (is_income = 0 or false)
  const expenseCategories = categories.filter(
    (c: { is_income: number | boolean }) => !c.is_income,
  );

  // First, calculate total budgeted amounts across ALL months in the period
  // This is needed for the summary comparison
  const totalBudgetedByCategory: Record<string, number> = {};
  let currentMonth = startMonth;
  const monthCount = countMonths(startMonth, endMonth);

  while (currentMonth <= endMonth) {
    const sheetName = monthUtils.sheetForMonth(currentMonth);

    for (const category of expenseCategories) {
      let budgetedAmount = 0;
      try {
        const value = sheet.getCellValue(sheetName, `budget-${category.id}`);
        budgetedAmount = typeof value === 'number' ? value : 0;
      } catch {
        budgetedAmount = 0;
      }
      totalBudgetedByCategory[category.id] =
        (totalBudgetedByCategory[category.id] || 0) + budgetedAmount;
    }

    currentMonth = monthUtils.addMonths(currentMonth, 1);
  }

  // Now iterate through each month to build the per-month breakdown
  currentMonth = startMonth;
  while (currentMonth <= endMonth) {
    const sheetName = monthUtils.sheetForMonth(currentMonth);
    const monthCategories: ForecastCategoryBreakdown[] = [];
    let totalBudgeted = 0;
    let totalForecasted = 0;

    for (const category of expenseCategories) {
      // Get budgeted amount from sheet for THIS month
      let monthlyBudget = 0;
      try {
        const value = sheet.getCellValue(sheetName, `budget-${category.id}`);
        monthlyBudget = typeof value === 'number' ? value : 0;
      } catch {
        monthlyBudget = 0;
      }

      // Get the total forecasted amount and distribute proportionally by month
      // For a more accurate comparison, we divide total forecasted by months
      const totalForecastedForCategory = forecastedAmounts[category.id] || 0;
      const monthlyForecasted = Math.round(totalForecastedForCategory / monthCount);

      // Calculate variance for this month (positive = under budget, negative = over budget)
      const variance = monthlyBudget - Math.abs(monthlyForecasted);

      monthCategories.push({
        categoryId: category.id,
        categoryName: category.name || 'Uncategorized',
        scheduledAmount: monthlyForecasted,
        budgetedAmount: monthlyBudget,
        variance,
      });

      totalBudgeted += monthlyBudget;
      totalForecasted += Math.abs(monthlyForecasted);
    }

    result.push({
      month: currentMonth,
      categories: monthCategories,
      totalBudgeted,
      totalForecasted,
    });

    currentMonth = monthUtils.addMonths(currentMonth, 1);
  }

  // Also update the categoryBreakdown with correct totals
  // This modifies the array in place
  for (const cat of categoryBreakdown) {
    const totalBudget = totalBudgetedByCategory[cat.categoryId] || 0;
    cat.budgetedAmount = totalBudget;
    // variance = budgeted - |forecasted| (positive = under budget)
    cat.variance = totalBudget - Math.abs(cat.scheduledAmount);
  }

  return result;
}

// Count months between start and end (inclusive)
function countMonths(startMonth: string, endMonth: string): number {
  let count = 0;
  let current = startMonth;
  while (current <= endMonth) {
    count++;
    current = monthUtils.addMonths(current, 1);
  }
  return Math.max(count, 1); // At least 1 to avoid division by zero
}

// Compare forecasted spending to budget for a specific category
export function compareForecastToBudget(
  forecastByCategory: Record<string, number>,
  budgetByCategory: Record<string, number>,
): ForecastCategoryBreakdown[] {
  const result: ForecastCategoryBreakdown[] = [];

  // Get all category IDs from both forecast and budget
  const allCategoryIds = new Set([
    ...Object.keys(forecastByCategory),
    ...Object.keys(budgetByCategory),
  ]);

  for (const categoryId of allCategoryIds) {
    const scheduledAmount = forecastByCategory[categoryId] || 0;
    const budgetedAmount = budgetByCategory[categoryId] || 0;
    const variance = budgetedAmount - Math.abs(scheduledAmount);

    result.push({
      categoryId,
      categoryName: '', // Will be filled in by caller
      scheduledAmount,
      budgetedAmount,
      variance,
    });
  }

  return result;
}

// Get budget data for a specific month and category
export function getBudgetValue(month: string, categoryId: string): number {
  try {
    const sheetName = monthUtils.sheetForMonth(month);
    const value = sheet.getCellValue(sheetName, `budget-${categoryId}`);
    return typeof value === 'number' ? value : 0;
  } catch {
    return 0;
  }
}

// Get all budget values for a month
export async function getMonthlyBudget(
  month: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Get all categories
  const { data: categories } = await aqlQuery(
    q('categories').select(['id', 'is_income']),
  );

  if (!categories) {
    return result;
  }

  const sheetName = monthUtils.sheetForMonth(month);

  for (const category of categories) {
    if (!category.is_income) {
      try {
        const value = sheet.getCellValue(sheetName, `budget-${category.id}`);
        result[category.id] = typeof value === 'number' ? value : 0;
      } catch {
        result[category.id] = 0;
      }
    }
  }

  return result;
}
