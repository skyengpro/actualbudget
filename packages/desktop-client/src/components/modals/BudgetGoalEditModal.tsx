import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type { BudgetGoalType } from 'loot-core/types/models';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { useFormat } from '@desktop-client/hooks/useFormat';
import {
  useBudgetGoalForCategory,
  useBudgetGoalMutations,
} from '@desktop-client/hooks/useBudgetGoals';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type BudgetGoalEditModalProps = Extract<
  ModalType,
  { name: 'budget-goal-edit' }
>['options'];

export function BudgetGoalEditModal({
  categoryId,
  categoryName,
  onSave,
}: BudgetGoalEditModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const { data: existingGoal, isLoading } =
    useBudgetGoalForCategory(categoryId);
  const { createGoal, updateGoal, deleteGoal, isCreating, isUpdating } =
    useBudgetGoalMutations();

  const [goalType, setGoalType] = useState<BudgetGoalType>('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Update state when existing goal loads
  useEffect(() => {
    if (existingGoal) {
      setGoalType(existingGoal.goal_type);
      setTargetAmount(format.forEdit(existingGoal.target_amount));
      setTargetDate(existingGoal.target_date || '');
    }
  }, [existingGoal, format]);

  const handleSave = async () => {
    // Parse amount
    const amount = format.fromEdit(targetAmount);
    if (amount === null || amount <= 0) {
      setError(t('Please enter a valid target amount'));
      return;
    }

    setError(null);

    if (existingGoal) {
      updateGoal(
        {
          id: existingGoal.id,
          fields: {
            goal_type: goalType,
            target_amount: amount,
            target_date: goalType === 'savings' ? targetDate || undefined : undefined,
          },
        },
        {
          onSuccess: () => {
            onSave?.();
            dispatch(closeModal());
          },
          onError: () => {
            setError(t('Failed to update goal'));
          },
        },
      );
    } else {
      createGoal(
        {
          category_id: categoryId,
          goal_type: goalType,
          target_amount: amount,
          target_date: goalType === 'savings' ? targetDate || undefined : undefined,
        },
        {
          onSuccess: () => {
            onSave?.();
            dispatch(closeModal());
          },
          onError: () => {
            setError(t('Failed to create goal'));
          },
        },
      );
    }
  };

  const handleDelete = () => {
    if (existingGoal && window.confirm(t('Are you sure you want to delete this goal?'))) {
      deleteGoal(existingGoal.id, {
        onSuccess: () => {
          onSave?.();
          dispatch(closeModal());
        },
      });
    }
  };

  const goalTypeOptions: Array<readonly [BudgetGoalType, string]> = [
    ['savings', t('Savings Goal')],
    ['spending-limit', t('Spending Limit')],
    ['target-balance', t('Target Balance')],
  ];

  return (
    <Modal name="budget-goal-edit">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle
                title={existingGoal ? t('Edit Goal') : t('Set Goal')}
                shrinkOnOverflow
              />
            }
            rightContent={<ModalCloseButton onPress={close} />}
          />

          <View style={{ padding: 20, minWidth: 350 }}>
            {isLoading ? (
              <Text>
                <Trans>Loading...</Trans>
              </Text>
            ) : (
              <>
                <Text
                  style={{
                    fontWeight: 600,
                    marginBottom: 16,
                    color: theme.pageText,
                  }}
                >
                  {categoryName}
                </Text>

                {error && <FormError>{error}</FormError>}

                <InlineField label={t('Goal Type')} width="100%">
                  <Select
                    value={goalType}
                    onChange={(value: BudgetGoalType) => setGoalType(value)}
                    options={goalTypeOptions}
                  />
                </InlineField>

                <View style={{ marginTop: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.pageTextSubdued,
                      marginBottom: 12,
                    }}
                  >
                    {goalType === 'savings' &&
                      t(
                        'Save towards a target amount by a specific date. Track your progress over time.',
                      )}
                    {goalType === 'spending-limit' &&
                      t(
                        'Set a maximum spending limit for this category. Get warned when approaching the limit.',
                      )}
                    {goalType === 'target-balance' &&
                      t(
                        'Maintain a specific balance in this category. Useful for emergency funds or reserves.',
                      )}
                  </Text>
                </View>

                <InlineField
                  label={t('Target Amount')}
                  width="100%"
                  style={{ marginTop: 12 }}
                >
                  <InitialFocus>
                    <Input
                      value={targetAmount}
                      onChangeValue={setTargetAmount}
                      placeholder={t('e.g., 1000')}
                    />
                  </InitialFocus>
                </InlineField>

                {goalType === 'savings' && (
                  <InlineField
                    label={t('Target Date (optional)')}
                    width="100%"
                    style={{ marginTop: 12 }}
                  >
                    <Input
                      type="month"
                      value={targetDate}
                      onChangeValue={setTargetDate}
                      min={monthUtils.currentMonth()}
                    />
                  </InlineField>
                )}

                <ModalButtons style={{ marginTop: 20 }}>
                  {existingGoal && (
                    <Button
                      variant="bare"
                      style={{ color: theme.errorText }}
                      onPress={handleDelete}
                    >
                      <Trans>Delete Goal</Trans>
                    </Button>
                  )}
                  <View style={{ flex: 1 }} />
                  <Button variant="bare" onPress={close}>
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={isCreating || isUpdating}
                    onPress={handleSave}
                  >
                    {isCreating || isUpdating ? (
                      <Trans>Saving...</Trans>
                    ) : existingGoal ? (
                      <Trans>Update Goal</Trans>
                    ) : (
                      <Trans>Set Goal</Trans>
                    )}
                  </Button>
                </ModalButtons>
              </>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
