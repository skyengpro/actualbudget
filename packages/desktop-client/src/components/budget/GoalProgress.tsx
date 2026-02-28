import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { BudgetGoalProgress } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type GoalProgressProps = {
  progress: BudgetGoalProgress;
  compact?: boolean;
};

export function GoalProgress({ progress, compact = false }: GoalProgressProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const {
    goal_type,
    target_amount,
    current_amount,
    progress_percentage,
    is_achieved,
    months_remaining,
    monthly_contribution,
  } = progress;

  // Determine progress bar color based on goal type and progress
  const getProgressColor = () => {
    if (is_achieved) {
      return theme.noticeTextLight;
    }
    if (goal_type === 'spending-limit') {
      // For spending limits, red when over limit
      if (progress_percentage > 100) return theme.errorText;
      if (progress_percentage > 80) return theme.warningText;
      return theme.noticeTextLight;
    }
    // For savings and target balance
    if (progress_percentage >= 100) return theme.noticeTextLight;
    if (progress_percentage >= 50) return theme.pageTextPositive;
    return theme.pageText;
  };

  const getGoalLabel = () => {
    switch (goal_type) {
      case 'savings':
        return t('Savings Goal');
      case 'spending-limit':
        return t('Spending Limit');
      case 'target-balance':
        return t('Target Balance');
      default:
        return t('Goal');
    }
  };

  const progressWidth = Math.min(progress_percentage, 100);

  if (compact) {
    return (
      <View
        style={{
          width: '100%',
          height: 4,
          backgroundColor: theme.tableBorder,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progressWidth}%`,
            height: '100%',
            backgroundColor: getProgressColor(),
            borderRadius: 2,
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ padding: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          {getGoalLabel()}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: is_achieved ? theme.noticeTextLight : theme.pageText,
            fontWeight: is_achieved ? 600 : 400,
          }}
        >
          {progress_percentage}%
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          width: '100%',
          height: 6,
          backgroundColor: theme.tableBorder,
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: `${progressWidth}%`,
            height: '100%',
            backgroundColor: getProgressColor(),
            borderRadius: 3,
          }}
        />
      </View>

      {/* Amount info */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          {format(current_amount, 'financial')}
        </Text>
        <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
          {format(target_amount, 'financial')}
        </Text>
      </View>

      {/* Additional info for savings goals */}
      {goal_type === 'savings' && months_remaining !== undefined && !is_achieved && (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: theme.pageTextSubdued }}>
            {t('{{months}} months remaining', { months: months_remaining })}
            {monthly_contribution && (
              <>
                {' - '}
                {t('{{amount}}/month needed', {
                  amount: format(monthly_contribution, 'financial'),
                })}
              </>
            )}
          </Text>
        </View>
      )}

      {/* Achievement message */}
      {is_achieved && (
        <Text
          style={{
            fontSize: 11,
            color: theme.noticeTextLight,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          {goal_type === 'spending-limit'
            ? t('Under budget!')
            : t('Goal achieved!')}
        </Text>
      )}
    </View>
  );
}

type GoalProgressBadgeProps = {
  progress: BudgetGoalProgress;
};

/**
 * A small badge indicator for goal progress, suitable for inline display
 */
export function GoalProgressBadge({ progress }: GoalProgressBadgeProps) {
  const { progress_percentage, is_achieved, goal_type } = progress;

  const getColor = () => {
    if (is_achieved) return theme.noticeTextLight;
    if (goal_type === 'spending-limit') {
      if (progress_percentage > 100) return theme.errorText;
      if (progress_percentage > 80) return theme.warningText;
    }
    return theme.pageTextSubdued;
  };

  return (
    <View
      style={{
        paddingHorizontal: 4,
        paddingVertical: 2,
        backgroundColor: getColor(),
        borderRadius: 4,
        marginLeft: 4,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          color: theme.buttonPrimaryText,
          fontWeight: 600,
        }}
      >
        {progress_percentage}%
      </Text>
    </View>
  );
}
