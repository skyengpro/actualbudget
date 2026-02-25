import { q } from 'loot-core/shared/query';
import * as monthUtils from 'loot-core/shared/months';

import type { useSpreadsheet } from '@desktop-client/hooks/useSpreadsheet';
import { aqlQuery } from '@desktop-client/queries/aqlQuery';

export type InsightAlert = {
  type: 'increase' | 'decrease' | 'unusual';
  category: string;
  categoryId: string;
  message: string;
  amount: number;
  percentChange: number;
};

export type MonthlyData = {
  month: string;
  monthLabel: string;
  amount: number;
};

export type PayeeData = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
};

export type CategoryTrendData = {
  id: string;
  name: string;
  color: string;
  data: { month: string; amount: number }[];
};

export type InsightsData = {
  summary: {
    thisMonth: number;
    lastMonth: number;
    average: number;
    change: number;
  };
  alerts: InsightAlert[];
  monthlyData: MonthlyData[];
  topPayees: PayeeData[];
  categoryTrends: CategoryTrendData[];
  months: string[];
};

export function createSpendingInsightsSpreadsheet({
  startDate,
  endDate,
  months,
}: {
  startDate: string;
  endDate: string;
  months: number;
}) {
  return async (
    spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: InsightsData) => void,
  ) => {
    // Query all transactions in the date range (expenses only)
    const query = q('transactions')
      .filter({
        $and: [
          { date: { $gte: `${startDate}-01` } },
          { date: { $lte: monthUtils.getMonthEnd(endDate) } },
          { amount: { $lt: 0 } }, // Only expenses
          { 'account.offbudget': false },
          { 'payee.transfer_acct': null }, // Exclude transfers
        ],
      })
      .select([
        'id',
        'date',
        'amount',
        { payee: 'payee.id' },
        { payeeName: 'payee.name' },
        { category: 'category.id' },
        { categoryName: 'category.name' },
      ]);

    const { data: transactions } = await aqlQuery(query);

    // Process data
    const monthlyTotals = new Map<string, number>();
    const payeeTotals = new Map<string, { name: string; amount: number }>();
    const categoryMonthly = new Map<
      string,
      { name: string; months: Map<string, number> }
    >();

    // Initialize months
    const monthsList: string[] = [];
    let currentMonth = startDate;
    while (currentMonth <= endDate) {
      monthsList.push(currentMonth);
      monthlyTotals.set(currentMonth, 0);
      currentMonth = monthUtils.addMonths(currentMonth, 1);
    }

    // Process each transaction
    for (const tx of transactions || []) {
      const txMonth = monthUtils.monthFromDate(tx.date);
      const amount = Math.abs(tx.amount);

      // Monthly totals
      if (monthlyTotals.has(txMonth)) {
        monthlyTotals.set(txMonth, (monthlyTotals.get(txMonth) || 0) + amount);
      }

      // Payee totals
      if (tx.payee && tx.payeeName) {
        const existing = payeeTotals.get(tx.payee);
        if (existing) {
          existing.amount += amount;
        } else {
          payeeTotals.set(tx.payee, { name: tx.payeeName, amount });
        }
      }

      // Category monthly
      if (tx.category && tx.categoryName) {
        let catData = categoryMonthly.get(tx.category);
        if (!catData) {
          catData = { name: tx.categoryName, months: new Map() };
          categoryMonthly.set(tx.category, catData);
        }
        const existing = catData.months.get(txMonth) || 0;
        catData.months.set(txMonth, existing + amount);
      }
    }

    // Calculate summary
    const currentMonthKey = monthUtils.currentMonth();
    const lastMonthKey = monthUtils.subMonths(currentMonthKey, 1);
    const thisMonth = monthlyTotals.get(currentMonthKey) || 0;
    const lastMonth = monthlyTotals.get(lastMonthKey) || 0;
    const totalSpending = Array.from(monthlyTotals.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const average = Math.round(totalSpending / months);
    const change = thisMonth - lastMonth;

    // Format monthly data
    const monthlyData: MonthlyData[] = monthsList.map(month => ({
      month,
      monthLabel: monthUtils.format(month, 'MMM yyyy'),
      amount: monthlyTotals.get(month) || 0,
    }));

    // Top payees (top 8)
    const sortedPayees = Array.from(payeeTotals.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8);

    const totalPayeeSpending = sortedPayees.reduce(
      (sum, [, data]) => sum + data.amount,
      0,
    );

    const topPayees: PayeeData[] = sortedPayees.map(([id, data]) => ({
      id,
      name: data.name,
      amount: data.amount,
      percentage:
        totalPayeeSpending > 0
          ? Math.round((data.amount / totalPayeeSpending) * 100)
          : 0,
    }));

    // Category trends (top 5 categories)
    const categoryTotals = Array.from(categoryMonthly.entries())
      .map(([id, data]) => {
        const total = Array.from(data.months.values()).reduce(
          (a, b) => a + b,
          0,
        );
        return { id, name: data.name, total, months: data.months };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const colors = [
      '#6366f1', // indigo
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f59e0b', // amber
      '#8b5cf6', // violet
    ];

    const categoryTrends: CategoryTrendData[] = categoryTotals.map(
      (cat, index) => ({
        id: cat.id,
        name: cat.name,
        color: colors[index % colors.length],
        data: monthsList.map(month => ({
          month,
          amount: cat.months.get(month) || 0,
        })),
      }),
    );

    // Generate alerts
    const alerts: InsightAlert[] = [];

    // Check for significant category changes
    for (const [catId, catData] of categoryMonthly.entries()) {
      const thisMonthAmt = catData.months.get(currentMonthKey) || 0;
      const lastMonthAmt = catData.months.get(lastMonthKey) || 0;

      if (lastMonthAmt > 0 && thisMonthAmt > 0) {
        const percentChange = ((thisMonthAmt - lastMonthAmt) / lastMonthAmt) * 100;

        if (percentChange >= 50 && thisMonthAmt > 5000) {
          // > 50% increase and > $50
          alerts.push({
            type: 'increase',
            category: catData.name,
            categoryId: catId,
            message: `${catData.name} spending increased by ${Math.round(percentChange)}%`,
            amount: thisMonthAmt - lastMonthAmt,
            percentChange: Math.round(percentChange),
          });
        } else if (percentChange <= -50 && lastMonthAmt > 5000) {
          // > 50% decrease
          alerts.push({
            type: 'decrease',
            category: catData.name,
            categoryId: catId,
            message: `${catData.name} spending decreased by ${Math.round(Math.abs(percentChange))}%`,
            amount: thisMonthAmt - lastMonthAmt,
            percentChange: Math.round(percentChange),
          });
        }
      }
    }

    // Check for unusual overall spending
    if (average > 0) {
      const overallChange = ((thisMonth - average) / average) * 100;
      if (overallChange > 30) {
        alerts.push({
          type: 'unusual',
          category: 'Overall',
          categoryId: '',
          message: `This month's spending is ${Math.round(overallChange)}% above your average`,
          amount: thisMonth - average,
          percentChange: Math.round(overallChange),
        });
      }
    }

    // Sort alerts by absolute percent change
    alerts.sort(
      (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
    );

    setData({
      summary: {
        thisMonth,
        lastMonth,
        average,
        change,
      },
      alerts: alerts.slice(0, 5), // Max 5 alerts
      monthlyData,
      topPayees,
      categoryTrends,
      months: monthsList,
    });
  };
}
