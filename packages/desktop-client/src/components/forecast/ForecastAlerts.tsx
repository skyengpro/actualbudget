import React from 'react';
import { useTranslation } from 'react-i18next';

import { SvgAlertTriangle } from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type { ForecastAlert } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type ForecastAlertsProps = {
  alerts: ForecastAlert[];
};

export function ForecastAlerts({ alerts }: ForecastAlertsProps) {
  const { t } = useTranslation();
  const format = useFormat();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      {alerts.map((alert, index) => {
        const isNegative = alert.type === 'negative_balance';
        const isOverBudget = alert.type === 'over_budget';
        const accentColor = isNegative
          ? theme.errorText
          : isOverBudget
            ? theme.errorText
            : theme.warningText;

        return (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              backgroundColor: theme.tableRowBackgroundHover,
              borderRadius: 6,
              borderLeft: `3px solid ${accentColor}`,
            }}
          >
            <SvgAlertTriangle
              style={{
                width: 16,
                height: 16,
                color: accentColor,
                flexShrink: 0,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: theme.pageText }}>
                {isNegative
                  ? t('Negative Balance Warning')
                  : isOverBudget
                    ? t('Over Budget')
                    : t('Low Balance Alert')}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.pageTextSubdued,
                  marginTop: 2,
                }}
              >
                {isOverBudget
                  ? alert.message
                  : t('{{amount}} on {{date}}', {
                      amount: format(alert.balance, 'financial'),
                      date: monthUtils.format(alert.date, 'MMM d'),
                    })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
