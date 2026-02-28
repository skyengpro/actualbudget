import React from 'react';
import { useTranslation } from 'react-i18next';

import { SvgFlag } from '@actual-app/components/icons/v1';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { theme } from '@actual-app/components/theme';

import { useBudgetGoalProgress } from '@desktop-client/hooks/useBudgetGoals';
import { useFormat } from '@desktop-client/hooks/useFormat';

type GoalIndicatorProps = {
  categoryId: string;
  month?: string;
};

export function GoalIndicator({ categoryId, month }: GoalIndicatorProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: progress, isLoading } = useBudgetGoalProgress(categoryId, month);

  if (isLoading || !progress) {
    return null;
  }

  const { goal_type, target_amount, current_amount, progress_percentage, is_achieved } = progress;

  // Determine color based on progress
  let color: string;
  let bgColor: string;

  if (goal_type === 'spending-limit') {
    // For spending limits: green if under, yellow if close, red if over
    if (progress_percentage <= 75) {
      color = theme.noticeTextLight;
      bgColor = theme.noticeBackgroundLight;
    } else if (progress_percentage <= 100) {
      color = theme.warningText;
      bgColor = theme.warningBackground;
    } else {
      color = theme.errorText;
      bgColor = theme.errorBackground;
    }
  } else {
    // For savings/target balance: green if achieved, yellow if close, gray if far
    if (is_achieved) {
      color = theme.noticeTextLight;
      bgColor = theme.noticeBackgroundLight;
    } else if (progress_percentage >= 75) {
      color = theme.warningText;
      bgColor = theme.warningBackground;
    } else {
      color = theme.pageTextSubdued;
      bgColor = theme.tableRowBackgroundHover;
    }
  }

  const goalTypeLabel = {
    'savings': t('Savings Goal'),
    'spending-limit': t('Spending Limit'),
    'target-balance': t('Target Balance'),
  }[goal_type] || goal_type;

  const tooltipContent = `${goalTypeLabel}: ${format(current_amount, 'financial')} / ${format(target_amount, 'financial')} (${Math.min(progress_percentage, 999)}%)`;

  return (
    <Tooltip content={tooltipContent} placement="right">
      <View
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: bgColor,
          marginLeft: 4,
          flexShrink: 0,
        }}
      >
        <SvgFlag
          width={10}
          height={10}
          style={{ color }}
        />
      </View>
    </Tooltip>
  );
}
