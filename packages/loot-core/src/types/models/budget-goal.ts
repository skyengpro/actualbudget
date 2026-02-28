export type BudgetGoalType = 'savings' | 'spending-limit' | 'target-balance';

export type BudgetGoalEntity = {
  id: string;
  category_id: string;
  goal_type: BudgetGoalType;
  /** Target amount in cents */
  target_amount: number;
  /** Target date in YYYY-MM format for savings goals */
  target_date?: string;
  created_at: string;
  updated_at: string;
  tombstone: 0 | 1;
};

export type NewBudgetGoalEntity = Omit<
  BudgetGoalEntity,
  'id' | 'tombstone' | 'created_at' | 'updated_at'
>;

export type BudgetGoalProgress = BudgetGoalEntity & {
  /** Current balance or accumulated amount */
  current_amount: number;
  /** Progress percentage (0-100+) */
  progress_percentage: number;
  /** Whether goal is achieved */
  is_achieved: boolean;
  /** For savings goals: months remaining */
  months_remaining?: number;
  /** For savings goals: required monthly contribution */
  monthly_contribution?: number;
};
