import * as d from 'date-fns';

import * as monthUtils from '../../shared/months';
import { q } from '../../shared/query';
import type { DetectedPattern, PredictedTransaction } from '../../types/models';
import { aqlQuery } from '../aql';

type TransactionData = {
  id: string;
  date: string;
  amount: number;
  payee: string;
  payee_name: string;
  category: string | null;
  category_name: string | null;
};

type PayeeGroup = {
  payeeId: string;
  payeeName: string;
  transactions: TransactionData[];
};

// Detect recurring patterns from transaction history
export async function detectRecurringPatterns(
  accountIds: string[],
  lookbackMonths: number = 6,
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  if (accountIds.length === 0) {
    return patterns;
  }

  const today = monthUtils.currentDay();
  const startDate = monthUtils.subMonths(today, lookbackMonths);

  // Get transactions from the lookback period
  const { data: transactions } = await aqlQuery(
    q('transactions')
      .filter({
        account: { $oneof: accountIds },
        date: { $gte: startDate },
        is_parent: false,
        tombstone: false,
      })
      .select(['id', 'date', 'amount', 'payee', 'category'])
      .orderBy({ date: 'desc' }),
  );

  if (!transactions || transactions.length === 0) {
    return patterns;
  }

  // Get payee names
  const payeeIds = [...new Set(transactions.map(t => t.payee).filter(Boolean))];
  const { data: payees } = await aqlQuery(
    q('payees')
      .filter({ id: { $oneof: payeeIds } })
      .select(['id', 'name']),
  );
  const payeeNames: Record<string, string> = {};
  for (const p of payees || []) {
    payeeNames[p.id] = p.name || 'Unknown';
  }

  // Get category names
  const categoryIds = [...new Set(transactions.map(t => t.category).filter(Boolean))];
  const { data: categories } = await aqlQuery(
    q('categories')
      .filter({ id: { $oneof: categoryIds } })
      .select(['id', 'name']),
  );
  const categoryNames: Record<string, string> = {};
  for (const c of categories || []) {
    categoryNames[c.id] = c.name || 'Uncategorized';
  }

  // Group transactions by payee
  const payeeGroups: Record<string, PayeeGroup> = {};

  for (const t of transactions) {
    if (!t.payee) continue;

    if (!payeeGroups[t.payee]) {
      payeeGroups[t.payee] = {
        payeeId: t.payee,
        payeeName: payeeNames[t.payee] || 'Unknown',
        transactions: [],
      };
    }

    payeeGroups[t.payee].transactions.push({
      ...t,
      payee_name: payeeNames[t.payee] || 'Unknown',
      category_name: t.category ? categoryNames[t.category] || null : null,
    });
  }

  // Analyze each payee group for recurring patterns
  for (const group of Object.values(payeeGroups)) {
    const pattern = analyzePayeeTransactions(group, today);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  // Sort by confidence
  patterns.sort((a, b) => b.confidence - a.confidence);

  return patterns;
}

// Analyze a group of transactions for a single payee to detect patterns
function analyzePayeeTransactions(
  group: PayeeGroup,
  today: string,
): DetectedPattern | null {
  const { transactions } = group;

  // Need at least 2 transactions to detect a pattern
  if (transactions.length < 2) {
    return null;
  }

  // Sort transactions by date
  const sortedTrans = [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // Calculate intervals between transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < sortedTrans.length; i++) {
    const prevDate = monthUtils.parseDate(sortedTrans[i - 1].date);
    const currDate = monthUtils.parseDate(sortedTrans[i].date);
    const daysDiff = d.differenceInDays(currDate, prevDate);
    intervals.push(daysDiff);
  }

  if (intervals.length === 0) {
    return null;
  }

  // Detect frequency based on average interval
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const frequency = detectFrequency(avgInterval, intervals);

  if (!frequency) {
    return null;
  }

  // Calculate confidence based on consistency of intervals
  const confidence = calculateConfidence(intervals, frequency);

  if (confidence < 0.5) {
    return null;
  }

  // Calculate average amount
  const amounts = sortedTrans.map(t => t.amount);
  const averageAmount = Math.round(
    amounts.reduce((a, b) => a + b, 0) / amounts.length,
  );

  // Get most common category
  const categoryCounts: Record<string, number> = {};
  for (const t of sortedTrans) {
    if (t.category) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }
  }
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let maxCount = 0;
  for (const [catId, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      categoryId = catId;
      categoryName = sortedTrans.find(t => t.category === catId)?.category_name || null;
    }
  }

  // Calculate next predicted date
  const lastDate = sortedTrans[sortedTrans.length - 1].date;
  const nextPredicted = calculateNextDate(lastDate, frequency);

  return {
    id: `pattern-${group.payeeId}`,
    payeeId: group.payeeId,
    payeeName: group.payeeName,
    categoryId,
    categoryName,
    averageAmount,
    frequency,
    confidence,
    nextPredicted,
    lastOccurrence: lastDate,
    occurrenceCount: sortedTrans.length,
  };
}

// Detect frequency based on average interval
function detectFrequency(
  avgInterval: number,
  intervals: number[],
): 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | null {
  // Weekly: ~7 days (5-9 range)
  if (avgInterval >= 5 && avgInterval <= 9) {
    return 'weekly';
  }

  // Biweekly: ~14 days (12-17 range)
  if (avgInterval >= 12 && avgInterval <= 17) {
    return 'biweekly';
  }

  // Monthly: ~30 days (25-35 range)
  if (avgInterval >= 25 && avgInterval <= 35) {
    return 'monthly';
  }

  // Quarterly: ~90 days (80-100 range)
  if (avgInterval >= 80 && avgInterval <= 100) {
    return 'quarterly';
  }

  return null;
}

// Calculate confidence based on consistency of intervals
function calculateConfidence(
  intervals: number[],
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly',
): number {
  const expectedInterval = getExpectedInterval(frequency);

  // Calculate variance from expected interval
  const deviations = intervals.map(i => Math.abs(i - expectedInterval));
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

  // Calculate confidence: lower deviation = higher confidence
  // If average deviation is 0, confidence is 1
  // If average deviation is >= expectedInterval, confidence is 0
  const maxDeviation = expectedInterval * 0.5; // Allow up to 50% deviation
  const confidence = Math.max(0, 1 - avgDeviation / maxDeviation);

  // Boost confidence based on number of occurrences
  const occurrenceBoost = Math.min(0.2, (intervals.length - 1) * 0.05);

  return Math.min(1, confidence + occurrenceBoost);
}

// Get expected interval in days for a frequency
function getExpectedInterval(
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly',
): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
  }
}

// Calculate next predicted date
function calculateNextDate(
  lastDate: string,
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly',
): string {
  const parsed = monthUtils.parseDate(lastDate);

  switch (frequency) {
    case 'weekly':
      return d.format(d.addDays(parsed, 7), 'yyyy-MM-dd');
    case 'biweekly':
      return d.format(d.addDays(parsed, 14), 'yyyy-MM-dd');
    case 'monthly':
      return d.format(d.addMonths(parsed, 1), 'yyyy-MM-dd');
    case 'quarterly':
      return d.format(d.addMonths(parsed, 3), 'yyyy-MM-dd');
  }
}

// Generate predicted transactions within forecast window
export function predictFutureTransactions(
  patterns: DetectedPattern[],
  startDate: string,
  endDate: string,
): PredictedTransaction[] {
  const predictions: PredictedTransaction[] = [];

  for (const pattern of patterns) {
    let nextDate = pattern.nextPredicted;
    let predictionIndex = 0;

    // Generate predictions until end date
    while (nextDate <= endDate) {
      // Only include predictions within our window
      if (nextDate >= startDate) {
        predictions.push({
          id: `${pattern.id}-${predictionIndex}`,
          patternId: pattern.id,
          payeeId: pattern.payeeId,
          payeeName: pattern.payeeName,
          categoryId: pattern.categoryId,
          categoryName: pattern.categoryName,
          amount: pattern.averageAmount,
          date: nextDate,
          confidence: pattern.confidence,
          isPredicted: true,
        });
      }

      // Calculate next date
      nextDate = calculateNextDate(nextDate, pattern.frequency);
      predictionIndex++;

      // Safety limit
      if (predictionIndex > 100) {
        break;
      }
    }
  }

  // Sort by date
  predictions.sort((a, b) => a.date.localeCompare(b.date));

  return predictions;
}
