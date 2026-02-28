export type BudgetScenarioEntity = {
  id: string;
  name: string;
  description?: string;
  /** The month this scenario is based on */
  base_month: string;
  created_at: string;
  updated_at: string;
  tombstone: 0 | 1;
};

export type NewBudgetScenarioEntity = Omit<
  BudgetScenarioEntity,
  'id' | 'tombstone' | 'created_at' | 'updated_at'
>;

export type BudgetScenarioDataEntity = {
  id: string;
  scenario_id: string;
  category_id: string;
  month: string;
  /** Amount in cents */
  amount: number;
};

export type ScenarioBudgetDiff = {
  category_id: string;
  category_name: string;
  current_amount: number;
  scenario_amount: number;
  difference: number;
  percentage_change: number;
};

export type ScenarioComparison = {
  scenario: BudgetScenarioEntity;
  month: string;
  total_current: number;
  total_scenario: number;
  total_difference: number;
  differences: ScenarioBudgetDiff[];
};

export type MonthSummary = {
  month: string;
  income_budgeted: number;
  income_actual: number;
  expenses_budgeted: number;
  expenses_actual: number;
  net_budgeted: number;
  net_actual: number;
  savings_rate: number;
};

export type MultiMonthComparison = {
  months: MonthSummary[];
  best_month: string | null;
  worst_month: string | null;
  average_expenses: number;
  average_income: number;
};
