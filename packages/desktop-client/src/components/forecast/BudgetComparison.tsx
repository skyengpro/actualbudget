import React from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { ForecastCategoryBreakdown } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type BudgetComparisonProps = {
  data: ForecastCategoryBreakdown[];
};

export function BudgetComparison({ data }: BudgetComparisonProps) {
  const { t } = useTranslation();
  const format = useFormat();

  // Filter to show only expense categories with budget or forecast
  const displayData = data
    .filter(d => d.budgetedAmount > 0 || d.scheduledAmount < 0)
    .sort((a, b) => Math.abs(b.scheduledAmount) - Math.abs(a.scheduledAmount));

  if (displayData.length === 0) {
    return (
      <View
        style={{
          padding: 20,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No budget data available for forecast period')}
        </Text>
      </View>
    );
  }

  // Calculate totals
  const totalBudgeted = displayData.reduce((sum, d) => sum + d.budgetedAmount, 0);
  const totalForecasted = displayData.reduce(
    (sum, d) => sum + Math.abs(d.scheduledAmount),
    0,
  );
  const totalVariance = totalBudgeted - totalForecasted;

  return (
    <View style={{ gap: 0 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          padding: '10px 12px',
          backgroundColor: theme.tableHeaderBackground,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Text
          style={{
            flex: 2,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Category')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          {t('Budgeted')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          {t('Forecasted')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          {t('Variance')}
        </Text>
      </View>

      {/* Rows */}
      {displayData.map((item, index) => {
        const isOverBudget = item.variance < 0;
        const isUnderBudget = item.variance > 0 && item.budgetedAmount > 0;
        const forecasted = Math.abs(item.scheduledAmount);

        return (
          <View
            key={item.categoryId}
            style={{
              flexDirection: 'row',
              padding: '10px 12px',
              backgroundColor:
                index % 2 === 0
                  ? theme.tableBackground
                  : theme.tableRowBackgroundHover,
              borderBottom:
                index === displayData.length - 1
                  ? 'none'
                  : `1px solid ${theme.tableBorder}`,
            }}
          >
            <Text
              style={{
                flex: 2,
                fontSize: 13,
                color: theme.pageText,
              }}
            >
              {item.categoryName}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                textAlign: 'right',
                color: theme.pageTextSubdued,
                ...styles.monoText,
              }}
            >
              {item.budgetedAmount > 0
                ? format(item.budgetedAmount, 'financial')
                : '-'}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                textAlign: 'right',
                color: theme.errorText,
                ...styles.monoText,
              }}
            >
              {forecasted > 0 ? format(forecasted, 'financial') : '-'}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'right',
                color: isOverBudget
                  ? theme.errorText
                  : isUnderBudget
                    ? theme.noticeTextLight
                    : theme.pageTextSubdued,
                ...styles.monoText,
              }}
            >
              {item.budgetedAmount > 0 || forecasted > 0 ? (
                <>
                  {item.variance >= 0 ? '+' : ''}
                  {format(item.variance, 'financial')}
                </>
              ) : (
                '-'
              )}
            </Text>
          </View>
        );
      })}

      {/* Totals Row */}
      <View
        style={{
          flexDirection: 'row',
          padding: '12px',
          backgroundColor: theme.tableHeaderBackground,
          borderTop: `2px solid ${theme.tableBorder}`,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
        }}
      >
        <Text
          style={{
            flex: 2,
            fontSize: 13,
            fontWeight: 600,
            color: theme.pageText,
          }}
        >
          {t('Total')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'right',
            color: theme.pageText,
            ...styles.monoText,
          }}
        >
          {format(totalBudgeted, 'financial')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'right',
            color: theme.errorText,
            ...styles.monoText,
          }}
        >
          {format(totalForecasted, 'financial')}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'right',
            color: totalVariance >= 0 ? theme.noticeTextLight : theme.errorText,
            ...styles.monoText,
          }}
        >
          {totalVariance >= 0 ? '+' : ''}
          {format(totalVariance, 'financial')}
        </Text>
      </View>
    </View>
  );
}
