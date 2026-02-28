import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { send } from 'loot-core/platform/client/connection';
import type {
  BudgetGoalEntity,
  BudgetGoalProgress,
  NewBudgetGoalEntity,
} from 'loot-core/types/models';

export function useBudgetGoals() {
  return useQuery({
    queryKey: ['budget-goals'],
    queryFn: async () => {
      const goals: BudgetGoalEntity[] = await send('budget-goal/list');
      return goals;
    },
    placeholderData: [],
    staleTime: 30000, // 30 seconds
  });
}

export function useBudgetGoal(id: string | null) {
  return useQuery({
    queryKey: ['budget-goal', id],
    queryFn: async () => {
      if (!id) return null;
      const goal: BudgetGoalEntity | null = await send('budget-goal/get', {
        id,
      });
      return goal;
    },
    enabled: !!id,
  });
}

export function useBudgetGoalForCategory(categoryId: string | null) {
  return useQuery({
    queryKey: ['budget-goal', 'category', categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      const goal: BudgetGoalEntity | null = await send(
        'budget-goal/get-for-category',
        { categoryId },
      );
      return goal;
    },
    enabled: !!categoryId,
    staleTime: 30000,
  });
}

export function useBudgetGoalProgress(
  categoryId: string | null,
  month?: string,
) {
  return useQuery({
    queryKey: ['budget-goal', 'progress', categoryId, month],
    queryFn: async () => {
      if (!categoryId) return null;
      const progress: BudgetGoalProgress | null = await send(
        'budget-goal/get-progress',
        { categoryId, month },
      );
      return progress;
    },
    enabled: !!categoryId,
    staleTime: 10000, // 10 seconds - more frequent updates for progress
  });
}

export function useBudgetGoalMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (goal: NewBudgetGoalEntity) => {
      return send('budget-goal/create', { goal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goal'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string;
      fields: Partial<
        Omit<BudgetGoalEntity, 'id' | 'tombstone' | 'created_at'>
      >;
    }) => {
      return send('budget-goal/update', { id, fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goal'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return send('budget-goal/delete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goal'] });
    },
  });

  return {
    createGoal: createMutation.mutate,
    updateGoal: updateMutation.mutate,
    deleteGoal: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
