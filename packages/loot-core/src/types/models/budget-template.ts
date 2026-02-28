export type BudgetTemplateData = {
  /** Category ID to budget amount mapping */
  categories: Record<string, number>;
  /** Optional: month the template was created from */
  sourceMonth?: string;
};

export type BudgetTemplateEntity = {
  id: string;
  name: string;
  description?: string;
  /** JSON-serialized BudgetTemplateData */
  data: string;
  created_at: string;
  updated_at: string;
  tombstone: 0 | 1;
};

export type NewBudgetTemplateEntity = Omit<
  BudgetTemplateEntity,
  'id' | 'tombstone' | 'created_at' | 'updated_at'
>;
