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
  }>;
};

export type ForecastConfig = {
  accountIds: string[]; // Accounts to include
  forecastDays: 30 | 60 | 90;
  lowBalanceThreshold: number;
  baseCurrency: string; // Base currency for conversions and display
};

export type ForecastAlert = {
  type: 'low_balance' | 'negative_balance';
  date: string;
  balance: number;
  currency: string;
  message: string;
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
};
