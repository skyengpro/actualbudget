export type CurrencyAmount = {
  currency: string; // ISO 4217 code (USD, EUR, XAF, etc.)
  amount: number; // Amount in cents/smallest unit
  convertedAmount?: number; // Amount converted to base currency
};

export type ExchangeRate = {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
};

export type ForecastEntry = {
  date: string; // YYYY-MM-DD
  // Per-currency balances
  balancesByCurrency: Record<string, number>;
  incomeByCurrency: Record<string, number>;
  expensesByCurrency: Record<string, number>;
  // Converted totals (to base currency)
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  // Scheduled items for this day
  scheduledItems: Array<{
    scheduleId: string;
    payeeName: string;
    amount: number;
    currency: string;
    accountId: string;
    accountName: string;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  // Category breakdown for this day
  categoryAmounts?: Record<string, number>; // categoryId -> total amount
};

export type ForecastConfig = {
  accountIds: string[]; // Accounts to include
  forecastDays: 30 | 60 | 90;
  lowBalanceThreshold: number;
  baseCurrency: string; // Base currency for conversions and display
  // Pattern detection options
  includePatterns?: boolean; // default false
  patternConfidenceThreshold?: number; // default 0.7
  // What-If scenario
  scenario?: WhatIfScenario | null;
};

export type ForecastAlert = {
  type: 'low_balance' | 'negative_balance' | 'over_budget';
  date: string;
  balance: number;
  currency: string;
  message: string;
  categoryId?: string; // For over_budget alerts
  categoryName?: string;
};

export type CurrencySummary = {
  currency: string;
  starting: number;
  ending: number;
  income: number;
  expenses: number;
};

export type ForecastData = {
  dailyBalances: ForecastEntry[];
  alerts: ForecastAlert[];
  // Per-currency summaries
  currencySummaries: CurrencySummary[];
  // Converted totals (base currency)
  startingBalance: number;
  endingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  // Metadata
  baseCurrency: string;
  currencies: string[]; // All currencies involved
  exchangeRates: Record<string, number>; // e.g., { "EUR_USD": 1.09 }
  // Category breakdown
  categoryBreakdown?: ForecastCategoryBreakdown[];
  // Budget comparison
  budgetComparison?: BudgetComparison[];
  // Pattern detection
  detectedPatterns?: DetectedPattern[];
  predictedTransactions?: PredictedTransaction[];
  // What-If scenario comparison
  scenarioComparison?: {
    baseline: { endingBalance: number; totalExpenses: number };
    scenario: { endingBalance: number; totalExpenses: number };
    difference: number;
  } | null;
};

// Budget Integration Types
export type ForecastCategoryBreakdown = {
  categoryId: string;
  categoryName: string;
  scheduledAmount: number;
  budgetedAmount: number;
  variance: number; // budgeted - scheduled (positive = under budget)
};

export type BudgetComparison = {
  month: string;
  categories: ForecastCategoryBreakdown[];
  totalBudgeted: number;
  totalForecasted: number;
};

// Pattern Detection Types
export type DetectedPattern = {
  id: string;
  payeeId: string;
  payeeName: string;
  categoryId: string | null;
  categoryName: string | null;
  averageAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  confidence: number; // 0-1
  nextPredicted: string; // YYYY-MM-DD
  lastOccurrence: string; // YYYY-MM-DD
  occurrenceCount: number;
};

export type PredictedTransaction = {
  id: string;
  patternId: string;
  payeeId: string;
  payeeName: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  date: string; // YYYY-MM-DD
  confidence: number;
  isPredicted: true;
};

// What-If Scenario Types
export type WhatIfScenario = {
  id: string;
  name: string;
  hypotheticalItems: HypotheticalItem[];
  disabledScheduleIds: string[];
};

export type HypotheticalItem = {
  id: string;
  payeeName: string;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  isRecurring: boolean;
  frequency?: 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
};
