import * as d from 'date-fns';

import * as monthUtils from '../../shared/months';
import { q } from '../../shared/query';
import {
  extractScheduleConds,
  getNextDate,
  getScheduledAmount,
  getStatus,
  scheduleIsRecurring,
} from '../../shared/schedules';
import type {
  BudgetComparison,
  CurrencySummary,
  DetectedPattern,
  ExchangeRate,
  ForecastAlert,
  ForecastCategoryBreakdown,
  ForecastConfig,
  ForecastData,
  ForecastEntry,
  PredictedTransaction,
} from '../../types/models';
import { createApp } from '../app';
import { aqlQuery } from '../aql';
import * as db from '../db';
import { detectRecurringPatterns, predictFutureTransactions } from './pattern-detection';
import { getBudgetForPeriod, compareForecastToBudget } from './budget-integration';

// Check if currency column exists in accounts table
function hasCurrencyColumn(): boolean {
  try {
    const result = db.runQuery<{ name: string }>(
      "PRAGMA table_info(accounts)",
      [],
      true,
    );
    return result.some(col => col.name === 'currency');
  } catch {
    return false;
  }
}

// Check if exchange_rates table exists
function hasExchangeRatesTable(): boolean {
  try {
    const result = db.runQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='exchange_rates'",
      [],
      true,
    );
    return result.length > 0;
  } catch {
    return false;
  }
}

// Get exchange rates from database
async function getExchangeRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};

  if (!hasExchangeRatesTable()) {
    return rates;
  }

  try {
    const result = db.runQuery<ExchangeRate>(
      'SELECT * FROM exchange_rates',
      [],
      true,
    );

    for (const row of result) {
      rates[`${row.from_currency}_${row.to_currency}`] = row.rate;
    }
  } catch {
    // Table might not exist yet, return empty rates
  }

  return rates;
}

// Convert amount from one currency to another
function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (!amount || fromCurrency === toCurrency) return amount || 0;

  const directKey = `${fromCurrency}_${toCurrency}`;
  if (rates[directKey]) {
    return Math.round(amount * rates[directKey]);
  }

  // Try reverse rate
  const reverseKey = `${toCurrency}_${fromCurrency}`;
  if (rates[reverseKey]) {
    return Math.round(amount / rates[reverseKey]);
  }

  // Try through USD as intermediate
  const toUSD = rates[`${fromCurrency}_USD`];
  const fromUSD = rates[`USD_${toCurrency}`];
  if (toUSD && fromUSD) {
    return Math.round(amount * toUSD * fromUSD);
  }

  // No conversion available, return original
  return amount || 0;
}

// Get account balances grouped by currency
async function getAccountBalancesByCurrency(
  accountIds: string[],
  defaultCurrency: string,
): Promise<{ balances: Record<string, number>; accountCurrencies: Record<string, string> }> {
  if (accountIds.length === 0) {
    return { balances: {}, accountCurrencies: {} };
  }

  const placeholders = accountIds.map(() => '?').join(',');
  const hasCurrency = hasCurrencyColumn();

  // Get account currencies
  const accountCurrencies: Record<string, string> = {};

  if (hasCurrency) {
    try {
      const accounts = db.runQuery<{ id: string; currency: string | null }>(
        `SELECT id, currency FROM accounts WHERE id IN (${placeholders})`,
        accountIds,
        true,
      );
      for (const acc of accounts) {
        accountCurrencies[acc.id] = acc.currency || defaultCurrency;
      }
    } catch {
      // If query fails, use default currency
      for (const id of accountIds) {
        accountCurrencies[id] = defaultCurrency;
      }
    }
  } else {
    // Currency column doesn't exist, use default
    for (const id of accountIds) {
      accountCurrencies[id] = defaultCurrency;
    }
  }

  // Get balances per account
  let result: Array<{ account: string; total: number }> = [];
  try {
    result = db.runQuery<{ account: string; total: number }>(
      `SELECT account, COALESCE(SUM(amount), 0) as total
       FROM v_transactions_internal
       WHERE account IN (${placeholders})
         AND tombstone = 0
         AND is_parent = 0
       GROUP BY account`,
      accountIds,
      true,
    );
  } catch (e) {
    console.error('Error getting account balances:', e);
  }

  // Sum balances by currency
  const balances: Record<string, number> = {};
  for (const row of result) {
    const currency = accountCurrencies[row.account] || defaultCurrency;
    balances[currency] = (balances[currency] || 0) + (row.total || 0);
  }

  return { balances, accountCurrencies };
}

// Get category names in batch
async function getCategoryNames(
  categoryIds: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const categories: Record<string, string> = {};
  const uniqueCategoryIds = [...new Set(categoryIds.filter((id): id is string => !!id))];

  if (uniqueCategoryIds.length > 0) {
    try {
      const { data } = await aqlQuery(
        q('categories')
          .filter({ id: { $oneof: uniqueCategoryIds } })
          .select(['id', 'name']),
      );
      for (const c of data || []) {
        if (c.id) categories[c.id] = c.name || 'Uncategorized';
      }
    } catch {
      // Ignore error
    }
  }

  return categories;
}

// Extract category from schedule actions
function extractCategoryFromSchedule(
  schedule: { _actions?: Array<{ op: string; field: string; value: unknown }> },
): string | null {
  if (!schedule._actions) return null;

  const categoryAction = schedule._actions.find(
    a => a.op === 'set' && a.field === 'category',
  );

  return (categoryAction?.value as string) || null;
}

// Get schedules for selected accounts
async function getSchedulesForAccounts(
  accountIds: string[],
  defaultAccountId?: string,
): Promise<
  Array<{
    id: string;
    next_date: string;
    completed: boolean;
    _payee: string;
    _account: string;
    _amount: number | { num1: number; num2: number };
    _date: { frequency?: string } | null;
    _conditions: Array<{ op: string; field: string; value: unknown }>;
    _actions?: Array<{ op: string; field: string; value: unknown }>;
  }>
> {
  try {
    const { data: schedules } = await aqlQuery(
      q('schedules')
        .filter({ completed: false })
        .select('*'),
    );

    if (!schedules || accountIds.length === 0) {
      return [];
    }

    // Include schedules that:
    // 1. Have an account that's in the selected accounts, OR
    // 2. Have no account (assign to default account for forecasting)
    return schedules
      .filter((s: { _account: string | null }) => {
        // If schedule has an account, it must be in the selected accounts
        if (s._account) {
          return accountIds.includes(s._account);
        }
        // If schedule has no account, include it (will use default)
        return true;
      })
      .map((s: { _account: string | null }) => ({
        ...s,
        // Assign default account if none specified
        _account: s._account || defaultAccountId || accountIds[0],
      }));
  } catch (e) {
    console.error('Error getting schedules:', e);
    return [];
  }
}

// Get schedule statuses
async function getScheduleStatuses(
  schedules: Array<{ id: string; next_date: string; completed: boolean }>,
) {
  const statuses = new Map<string, string>();

  if (!schedules || schedules.length === 0) {
    return statuses;
  }

  try {
    const { data: upcomingLength } = await aqlQuery(
      q('preferences')
        .filter({ id: 'upcomingScheduledTransactionLength' })
        .select('value'),
    );
    const upcomingLengthValue = upcomingLength?.[0]?.value ?? '7';

    for (const schedule of schedules) {
      if (!schedule.next_date) {
        statuses.set(schedule.id, 'scheduled');
        continue;
      }

      let hasTrans = false;
      try {
        const { data: transactions } = await aqlQuery(
          q('transactions')
            .filter({
              schedule: schedule.id,
              date: { $gte: monthUtils.subDays(schedule.next_date, 2) },
            })
            .select(['id']),
        );
        hasTrans = transactions && transactions.length > 0;
      } catch {
        // Ignore error
      }

      const status = getStatus(
        schedule.next_date,
        schedule.completed,
        hasTrans,
        upcomingLengthValue,
      );
      statuses.set(schedule.id, status);
    }
  } catch (e) {
    console.error('Error getting schedule statuses:', e);
  }

  return statuses;
}

// Get payee and account names in batch
async function getNames(
  payeeIds: (string | null | undefined)[],
  accountIds: (string | null | undefined)[],
): Promise<{ payees: Record<string, string>; accounts: Record<string, string> }> {
  const payees: Record<string, string> = {};
  const accounts: Record<string, string> = {};

  const uniquePayeeIds = [...new Set(payeeIds.filter((id): id is string => !!id))];
  const uniqueAccountIds = [...new Set(accountIds.filter((id): id is string => !!id))];

  if (uniquePayeeIds.length > 0) {
    try {
      const { data } = await aqlQuery(
        q('payees')
          .filter({ id: { $oneof: uniquePayeeIds } })
          .select(['id', 'name']),
      );
      for (const p of data || []) {
        if (p.id) payees[p.id] = p.name || 'Unknown';
      }
    } catch {
      // Ignore error
    }
  }

  if (uniqueAccountIds.length > 0) {
    try {
      const { data } = await aqlQuery(
        q('accounts')
          .filter({ id: { $oneof: uniqueAccountIds } })
          .select(['id', 'name']),
      );
      for (const a of data || []) {
        if (a.id) accounts[a.id] = a.name || 'Unknown';
      }
    } catch {
      // Ignore error
    }
  }

  return { payees, accounts };
}

export async function calculateForecast({
  config,
}: {
  config: ForecastConfig;
}): Promise<ForecastData> {
  const {
    accountIds,
    forecastDays,
    lowBalanceThreshold,
    baseCurrency,
    includePatterns = false,
    patternConfidenceThreshold = 0.7,
    scenario = null,
  } = config;
  const safeCurrency = baseCurrency || 'USD';

  try {
    // Get exchange rates
    const exchangeRates = await getExchangeRates();

    // Get starting balances by currency
    const { balances: startingBalances, accountCurrencies } =
      await getAccountBalancesByCurrency(accountIds, safeCurrency);

    // Get all currencies involved
    const currencies = [...new Set(Object.values(accountCurrencies))];
    if (currencies.length === 0) {
      currencies.push(safeCurrency);
    }

    // Get schedules (pass first selected account as default for schedules without account)
    const schedules = await getSchedulesForAccounts(accountIds, accountIds[0]);
    const statuses = await getScheduleStatuses(schedules);

    // Extract category IDs from schedules
    const scheduleCategoryIds = schedules.map(s => extractCategoryFromSchedule(s));

    // Get names in batch
    const { payees: payeeNames, accounts: accountNames } = await getNames(
      schedules.map(s => s._payee),
      schedules.map(s => s._account),
    );

    // Get category names
    const categoryNames = await getCategoryNames(scheduleCategoryIds);

    // Calculate date range
    const today = monthUtils.currentDay();
    const endDate = monthUtils.addDays(today, forecastDays);

    // Initialize daily entries
    const dailyMap = new Map<string, ForecastEntry>();
    let currentDate = today;
    while (currentDate <= endDate) {
      const entry: ForecastEntry = {
        date: currentDate,
        balancesByCurrency: {},
        incomeByCurrency: {},
        expensesByCurrency: {},
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        scheduledItems: [],
        categoryAmounts: {},
      };

      // Initialize all currencies
      for (const currency of currencies) {
        entry.balancesByCurrency[currency] = 0;
        entry.incomeByCurrency[currency] = 0;
        entry.expensesByCurrency[currency] = 0;
      }

      dailyMap.set(currentDate, entry);
      currentDate = monthUtils.addDays(currentDate, 1);
    }

    // Track total amounts per category across all days
    const totalCategoryAmounts: Record<string, number> = {};

    // Process schedules
    for (const schedule of schedules) {
      const status = statuses.get(schedule.id);
      if (schedule.completed) continue;

      // Skip disabled schedules in scenario mode
      if (scenario && scenario.disabledScheduleIds.includes(schedule.id)) {
        continue;
      }

      const { date: dateConditions } = extractScheduleConds(schedule._conditions || []);
      const isRecurring = scheduleIsRecurring(dateConditions);
      const amount = getScheduledAmount(schedule._amount);
      const currency = accountCurrencies[schedule._account] || safeCurrency;
      const payeeName = schedule._payee ? (payeeNames[schedule._payee] || 'Unknown Payee') : '';
      const accountName = schedule._account ? (accountNames[schedule._account] || 'Unknown Account') : '';

      // Extract category information
      const categoryId = extractCategoryFromSchedule(schedule);
      const categoryName = categoryId ? (categoryNames[categoryId] || null) : null;

      // Collect dates for this schedule
      const scheduleDates: string[] = [];

      if (isRecurring && dateConditions) {
        let nextDate = schedule.next_date;

        if (status === 'paid' && dateConditions) {
          try {
            const nextOccurrence = getNextDate(
              dateConditions,
              d.addDays(monthUtils.parseDate(nextDate), 1),
            );
            if (nextOccurrence) {
              nextDate = nextOccurrence;
            }
          } catch {
            // Use current next_date
          }
        }

        let iterations = 0;
        const maxIterations = forecastDays + 10; // Safety limit

        while (nextDate && nextDate <= endDate && iterations < maxIterations) {
          iterations++;
          if (nextDate >= today) {
            scheduleDates.push(nextDate);
          }

          try {
            const nextOccurrence = getNextDate(
              dateConditions,
              d.addDays(monthUtils.parseDate(nextDate), 1),
            );

            if (!nextOccurrence || nextOccurrence === nextDate) {
              break;
            }
            nextDate = nextOccurrence;
          } catch {
            break;
          }
        }
      } else {
        if (
          schedule.next_date &&
          schedule.next_date >= today &&
          schedule.next_date <= endDate &&
          status !== 'paid'
        ) {
          scheduleDates.push(schedule.next_date);
        }
      }

      // Add occurrences to daily entries
      for (const date of scheduleDates) {
        const entry = dailyMap.get(date);
        if (entry) {
          entry.scheduledItems.push({
            scheduleId: schedule.id,
            payeeName,
            amount,
            currency,
            accountId: schedule._account,
            accountName,
            categoryId,
            categoryName,
          });

          if (amount > 0) {
            entry.incomeByCurrency[currency] =
              (entry.incomeByCurrency[currency] || 0) + amount;
          } else {
            entry.expensesByCurrency[currency] =
              (entry.expensesByCurrency[currency] || 0) + amount;
          }

          // Track category amounts
          if (categoryId) {
            entry.categoryAmounts![categoryId] =
              (entry.categoryAmounts![categoryId] || 0) + amount;
            totalCategoryAmounts[categoryId] =
              (totalCategoryAmounts[categoryId] || 0) + amount;
          }
        }
      }
    }

    // Add hypothetical items from scenario
    if (scenario) {
      for (const item of scenario.hypotheticalItems) {
        if (item.isRecurring && item.frequency) {
          // Add recurring hypothetical items
          let itemDate = item.startDate;
          while (itemDate <= endDate) {
            if (itemDate >= today) {
              const entry = dailyMap.get(itemDate);
              if (entry) {
                entry.scheduledItems.push({
                  scheduleId: `hypothetical-${item.id}`,
                  payeeName: item.payeeName,
                  amount: item.amount,
                  currency: safeCurrency,
                  accountId: '',
                  accountName: 'Hypothetical',
                  categoryId: item.categoryId,
                  categoryName: item.categoryName,
                });

                if (item.amount > 0) {
                  entry.incomeByCurrency[safeCurrency] =
                    (entry.incomeByCurrency[safeCurrency] || 0) + item.amount;
                } else {
                  entry.expensesByCurrency[safeCurrency] =
                    (entry.expensesByCurrency[safeCurrency] || 0) + item.amount;
                }

                if (item.categoryId) {
                  entry.categoryAmounts![item.categoryId] =
                    (entry.categoryAmounts![item.categoryId] || 0) + item.amount;
                  totalCategoryAmounts[item.categoryId] =
                    (totalCategoryAmounts[item.categoryId] || 0) + item.amount;
                }
              }
            }

            // Calculate next date based on frequency
            if (item.frequency === 'weekly') {
              itemDate = monthUtils.addDays(itemDate, 7);
            } else if (item.frequency === 'biweekly') {
              itemDate = monthUtils.addDays(itemDate, 14);
            } else {
              // monthly - add one month
              const parsed = monthUtils.parseDate(itemDate);
              itemDate = d.format(d.addMonths(parsed, 1), 'yyyy-MM-dd');
            }
          }
        } else {
          // Single hypothetical item
          if (item.startDate >= today && item.startDate <= endDate) {
            const entry = dailyMap.get(item.startDate);
            if (entry) {
              entry.scheduledItems.push({
                scheduleId: `hypothetical-${item.id}`,
                payeeName: item.payeeName,
                amount: item.amount,
                currency: safeCurrency,
                accountId: '',
                accountName: 'Hypothetical',
                categoryId: item.categoryId,
                categoryName: item.categoryName,
              });

              if (item.amount > 0) {
                entry.incomeByCurrency[safeCurrency] =
                  (entry.incomeByCurrency[safeCurrency] || 0) + item.amount;
              } else {
                entry.expensesByCurrency[safeCurrency] =
                  (entry.expensesByCurrency[safeCurrency] || 0) + item.amount;
              }

              if (item.categoryId) {
                entry.categoryAmounts![item.categoryId] =
                  (entry.categoryAmounts![item.categoryId] || 0) + item.amount;
                totalCategoryAmounts[item.categoryId] =
                  (totalCategoryAmounts[item.categoryId] || 0) + item.amount;
              }
            }
          }
        }
      }
    }

    // Pattern detection
    let detectedPatterns: DetectedPattern[] = [];
    let predictedTransactions: PredictedTransaction[] = [];

    if (includePatterns) {
      try {
        detectedPatterns = await detectRecurringPatterns(accountIds, 6); // Look back 6 months
        const filteredPatterns = detectedPatterns.filter(
          p => p.confidence >= patternConfidenceThreshold,
        );
        predictedTransactions = predictFutureTransactions(
          filteredPatterns,
          today,
          endDate,
        );

        // Add predicted transactions to daily entries
        for (const predicted of predictedTransactions) {
          const entry = dailyMap.get(predicted.date);
          if (entry) {
            entry.scheduledItems.push({
              scheduleId: `predicted-${predicted.id}`,
              payeeName: predicted.payeeName,
              amount: predicted.amount,
              currency: safeCurrency,
              accountId: '',
              accountName: 'Predicted',
              categoryId: predicted.categoryId,
              categoryName: predicted.categoryName,
            });

            if (predicted.amount > 0) {
              entry.incomeByCurrency[safeCurrency] =
                (entry.incomeByCurrency[safeCurrency] || 0) + predicted.amount;
            } else {
              entry.expensesByCurrency[safeCurrency] =
                (entry.expensesByCurrency[safeCurrency] || 0) + predicted.amount;
            }

            if (predicted.categoryId) {
              entry.categoryAmounts![predicted.categoryId] =
                (entry.categoryAmounts![predicted.categoryId] || 0) + predicted.amount;
              totalCategoryAmounts[predicted.categoryId] =
                (totalCategoryAmounts[predicted.categoryId] || 0) + predicted.amount;
            }
          }
        }
      } catch (e) {
        console.error('Pattern detection error:', e);
      }
    }

    // Calculate running balances and alerts
    const dailyBalances: ForecastEntry[] = [];
    const alerts: ForecastAlert[] = [];
    const runningBalances: Record<string, number> = { ...startingBalances };
    const currencyTotals: Record<string, { income: number; expenses: number }> = {};

    // Initialize currency totals
    for (const currency of currencies) {
      currencyTotals[currency] = { income: 0, expenses: 0 };
      if (runningBalances[currency] === undefined) {
        runningBalances[currency] = 0;
      }
    }

    let hasAlertedLowBalance = false;
    let hasAlertedNegativeBalance = false;

    currentDate = today;
    while (currentDate <= endDate) {
      const entry = dailyMap.get(currentDate)!;

      // Update running balances for each currency
      for (const currency of currencies) {
        const dayIncome = entry.incomeByCurrency[currency] || 0;
        const dayExpenses = entry.expensesByCurrency[currency] || 0;

        runningBalances[currency] = (runningBalances[currency] || 0) + dayIncome + dayExpenses;
        entry.balancesByCurrency[currency] = runningBalances[currency];

        currencyTotals[currency].income += dayIncome;
        currencyTotals[currency].expenses += dayExpenses;
      }

      // Calculate converted totals
      let totalBalance = 0;
      let totalIncome = 0;
      let totalExpenses = 0;

      for (const currency of currencies) {
        totalBalance += convertCurrency(
          entry.balancesByCurrency[currency] || 0,
          currency,
          safeCurrency,
          exchangeRates,
        );
        totalIncome += convertCurrency(
          entry.incomeByCurrency[currency] || 0,
          currency,
          safeCurrency,
          exchangeRates,
        );
        totalExpenses += convertCurrency(
          entry.expensesByCurrency[currency] || 0,
          currency,
          safeCurrency,
          exchangeRates,
        );
      }

      entry.totalBalance = totalBalance;
      entry.totalIncome = totalIncome;
      entry.totalExpenses = totalExpenses;

      // Check for alerts (based on base currency totals)
      if (totalBalance < 0 && !hasAlertedNegativeBalance) {
        alerts.push({
          type: 'negative_balance',
          date: currentDate,
          balance: totalBalance,
          currency: safeCurrency,
          message: `Total balance goes negative on ${currentDate}`,
        });
        hasAlertedNegativeBalance = true;
      } else if (
        totalBalance < lowBalanceThreshold &&
        totalBalance >= 0 &&
        !hasAlertedLowBalance
      ) {
        alerts.push({
          type: 'low_balance',
          date: currentDate,
          balance: totalBalance,
          currency: safeCurrency,
          message: `Total balance drops below threshold on ${currentDate}`,
        });
        hasAlertedLowBalance = true;
      }

      dailyBalances.push(entry);
      currentDate = monthUtils.addDays(currentDate, 1);
    }

    // Build currency summaries
    const currencySummaries: CurrencySummary[] = currencies.map(currency => ({
      currency,
      starting: startingBalances[currency] || 0,
      ending: runningBalances[currency] || 0,
      income: currencyTotals[currency]?.income || 0,
      expenses: currencyTotals[currency]?.expenses || 0,
    }));

    // Calculate converted totals
    let totalStarting = 0;
    let totalEnding = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const summary of currencySummaries) {
      totalStarting += convertCurrency(
        summary.starting,
        summary.currency,
        safeCurrency,
        exchangeRates,
      );
      totalEnding += convertCurrency(
        summary.ending,
        summary.currency,
        safeCurrency,
        exchangeRates,
      );
      totalIncome += convertCurrency(
        summary.income,
        summary.currency,
        safeCurrency,
        exchangeRates,
      );
      totalExpenses += convertCurrency(
        summary.expenses,
        summary.currency,
        safeCurrency,
        exchangeRates,
      );
    }

    // Build category breakdown
    const categoryBreakdown: ForecastCategoryBreakdown[] = [];
    const allCategoryIds = Object.keys(totalCategoryAmounts);
    const allCategoryNames = await getCategoryNames(allCategoryIds);

    for (const catId of allCategoryIds) {
      categoryBreakdown.push({
        categoryId: catId,
        categoryName: allCategoryNames[catId] || 'Uncategorized',
        scheduledAmount: totalCategoryAmounts[catId],
        budgetedAmount: 0,
        variance: 0,
      });
    }

    // Budget comparison
    let budgetComparison: BudgetComparison[] = [];
    try {
      const startMonth = monthUtils.monthFromDate(today);
      const endMonth = monthUtils.monthFromDate(endDate);

      // getBudgetForPeriod now properly sums budgets across all months
      // and updates categoryBreakdown with correct totals in place
      budgetComparison = await getBudgetForPeriod(
        startMonth,
        endMonth,
        totalCategoryAmounts,
        categoryBreakdown,
      );

      // Add over_budget alerts for categories that exceed their budget
      for (const cat of categoryBreakdown) {
        if (cat.budgetedAmount > 0 && Math.abs(cat.scheduledAmount) > cat.budgetedAmount) {
          const overAmount = Math.abs(cat.scheduledAmount) - cat.budgetedAmount;
          alerts.push({
            type: 'over_budget',
            date: today,
            balance: cat.scheduledAmount,
            currency: safeCurrency,
            message: `${cat.categoryName} forecast exceeds budget by ${overAmount}`,
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
          });
        }
      }
    } catch (e) {
      console.error('Budget comparison error:', e);
    }

    // Calculate scenario comparison if applicable
    let scenarioComparison = null;
    if (scenario) {
      // Calculate baseline (without scenario modifications)
      const baselineConfig = { ...config, scenario: null };
      const baseline = await calculateForecast({ config: baselineConfig });

      scenarioComparison = {
        baseline: {
          endingBalance: baseline.endingBalance,
          totalExpenses: baseline.totalExpenses,
        },
        scenario: {
          endingBalance: totalEnding,
          totalExpenses,
        },
        difference: totalEnding - baseline.endingBalance,
      };
    }

    return {
      dailyBalances,
      alerts,
      currencySummaries,
      startingBalance: totalStarting,
      endingBalance: totalEnding,
      totalIncome,
      totalExpenses,
      baseCurrency: safeCurrency,
      currencies,
      exchangeRates,
      categoryBreakdown,
      budgetComparison,
      detectedPatterns: includePatterns ? detectedPatterns : undefined,
      predictedTransactions: includePatterns ? predictedTransactions : undefined,
      scenarioComparison,
    };
  } catch (error) {
    console.error('Forecast calculation error:', error);
    // Return empty data on error
    return {
      dailyBalances: [],
      alerts: [],
      currencySummaries: [],
      startingBalance: 0,
      endingBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
      baseCurrency: safeCurrency,
      currencies: [safeCurrency],
      exchangeRates: {},
      categoryBreakdown: [],
      budgetComparison: [],
    };
  }
}

// Update exchange rate
export async function updateExchangeRate({
  fromCurrency,
  toCurrency,
  rate,
}: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}): Promise<void> {
  if (!hasExchangeRatesTable()) {
    return;
  }

  const id = `${fromCurrency}_${toCurrency}`;
  const now = new Date().toISOString();

  db.runQuery(
    `INSERT OR REPLACE INTO exchange_rates (id, from_currency, to_currency, rate, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, fromCurrency, toCurrency, rate, now],
  );
}

// Get all exchange rates
export async function listExchangeRates(): Promise<ExchangeRate[]> {
  if (!hasExchangeRatesTable()) {
    return [];
  }

  try {
    return db.runQuery<ExchangeRate>(
      'SELECT * FROM exchange_rates ORDER BY from_currency, to_currency',
      [],
      true,
    );
  } catch {
    return [];
  }
}

export type ForecastHandlers = {
  'forecast/calculate': typeof calculateForecast;
  'forecast/update-exchange-rate': typeof updateExchangeRate;
  'forecast/list-exchange-rates': typeof listExchangeRates;
};

export const app = createApp<ForecastHandlers>();

app.method('forecast/calculate', calculateForecast);
app.method('forecast/update-exchange-rate', updateExchangeRate);
app.method('forecast/list-exchange-rates', listExchangeRates);
