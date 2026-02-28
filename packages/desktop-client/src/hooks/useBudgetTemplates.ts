import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { send } from 'loot-core/platform/client/connection';
import type { BudgetTemplateEntity } from 'loot-core/types/models';

export function useBudgetTemplates() {
  return useQuery({
    queryKey: ['budget-templates'],
    queryFn: async () => {
      const templates: BudgetTemplateEntity[] = await send('budget-template/list');
      return templates;
    },
    placeholderData: [],
    staleTime: 30000, // 30 seconds
  });
}

export function useBudgetTemplate(id: string | null) {
  return useQuery({
    queryKey: ['budget-template', id],
    queryFn: async () => {
      if (!id) return null;
      const template: BudgetTemplateEntity | null = await send('budget-template/get', { id });
      return template;
    },
    enabled: !!id,
  });
}

export function useBudgetTemplateMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (template: { name: string; description?: string; data: string }) => {
      return send('budget-template/create', { template });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-templates'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<{ name: string; description: string; data: string }> }) => {
      return send('budget-template/update', { id, fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return send('budget-template/delete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-templates'] });
    },
  });

  const saveCurrentMutation = useMutation({
    mutationFn: async ({ name, description, month }: { name: string; description?: string; month?: string }) => {
      return send('budget-template/save-current', { name, description, month });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-templates'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ id, month }: { id: string; month?: string }) => {
      return send('budget-template/apply', { id, month });
    },
  });

  return {
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
    saveCurrentAsTempate: saveCurrentMutation.mutate,
    applyTemplate: applyMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSaving: saveCurrentMutation.isPending,
    isApplying: applyMutation.isPending,
  };
}
