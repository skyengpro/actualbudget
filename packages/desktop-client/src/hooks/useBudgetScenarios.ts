import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { send } from 'loot-core/platform/client/connection';
import type {
  BudgetScenarioEntity,
  BudgetScenarioDataEntity,
  NewBudgetScenarioEntity,
  ScenarioComparison,
  MultiMonthComparison,
} from 'loot-core/types/models';

export function useBudgetScenarios() {
  return useQuery({
    queryKey: ['budget-scenarios'],
    queryFn: async () => {
      const scenarios: BudgetScenarioEntity[] = await send(
        'budget-scenario/list',
      );
      return scenarios;
    },
    placeholderData: [],
    staleTime: 30000,
  });
}

export function useBudgetScenario(id: string | null) {
  return useQuery({
    queryKey: ['budget-scenario', id],
    queryFn: async () => {
      if (!id) return null;
      const scenario: BudgetScenarioEntity | null = await send(
        'budget-scenario/get',
        { id },
      );
      return scenario;
    },
    enabled: !!id,
  });
}

export function useScenarioBudgetData(scenarioId: string | null, month?: string) {
  return useQuery({
    queryKey: ['budget-scenario', 'data', scenarioId, month],
    queryFn: async () => {
      if (!scenarioId) return [];
      const data: BudgetScenarioDataEntity[] = await send(
        'budget-scenario/get-data',
        { scenarioId, month },
      );
      return data;
    },
    enabled: !!scenarioId,
    staleTime: 10000,
  });
}

export function useScenarioComparison(scenarioId: string | null, month?: string) {
  return useQuery({
    queryKey: ['budget-scenario', 'compare', scenarioId, month],
    queryFn: async () => {
      if (!scenarioId) return null;
      const comparison: ScenarioComparison | null = await send(
        'budget-scenario/compare',
        { scenarioId, month },
      );
      return comparison;
    },
    enabled: !!scenarioId,
    staleTime: 10000,
  });
}

export function useMultiMonthComparison(months: string[]) {
  return useQuery({
    queryKey: ['budget-scenario', 'compare-months', months],
    queryFn: async () => {
      if (months.length === 0) return null;
      const comparison: MultiMonthComparison = await send(
        'budget-scenario/compare-months',
        { months },
      );
      return comparison;
    },
    enabled: months.length > 0,
    staleTime: 30000,
  });
}

export function useBudgetScenarioMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (scenario: NewBudgetScenarioEntity) => {
      return send('budget-scenario/create', { scenario });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-scenarios'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string;
      fields: Partial<
        Omit<BudgetScenarioEntity, 'id' | 'tombstone' | 'created_at'>
      >;
    }) => {
      return send('budget-scenario/update', { id, fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['budget-scenario'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return send('budget-scenario/delete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-scenarios'] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async ({
      name,
      description,
      month,
    }: {
      name: string;
      description?: string;
      month?: string;
    }) => {
      return send('budget-scenario/clone-current', { name, description, month });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-scenarios'] });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({
      scenarioId,
      categoryId,
      month,
      amount,
    }: {
      scenarioId: string;
      categoryId: string;
      month: string;
      amount: number;
    }) => {
      return send('budget-scenario/update-budget', {
        scenarioId,
        categoryId,
        month,
        amount,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['budget-scenario', 'data', variables.scenarioId],
      });
      queryClient.invalidateQueries({
        queryKey: ['budget-scenario', 'compare', variables.scenarioId],
      });
    },
  });

  return {
    createScenario: createMutation.mutate,
    updateScenario: updateMutation.mutate,
    deleteScenario: deleteMutation.mutate,
    cloneCurrentBudget: cloneMutation.mutate,
    updateScenarioBudget: updateBudgetMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCloning: cloneMutation.isPending,
  };
}
