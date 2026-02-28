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
        const bgColor = isNegative
          ? theme.errorBackground
          : theme.warningBackground;
        const borderColor = isNegative
          ? theme.errorBorder
          : theme.warningBorder;
        const iconColor = isNegative ? theme.errorText : theme.warningText;

        return (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              backgroundColor: bgColor,
              borderRadius: 6,
              border: `1px solid ${borderColor}`,
            }}
          >
            <SvgAlertTriangle
              style={{
                width: 20,
                height: 20,
                color: iconColor,
                flexShrink: 0,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 500, color: theme.pageText }}>
                {isNegative
                  ? t('Negative Balance Warning')
                  : t('Low Balance Alert')}
                {alert.currency && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      marginLeft: 8,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    ({alert.currency})
                  </Text>
                )}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.pageTextSubdued,
                  marginTop: 2,
                }}
              >
                {t('Balance drops to {{amount}} {{currency}} on {{date}}', {
                  amount: format(alert.balance, 'financial'),
                  currency: alert.currency || '',
                  date: monthUtils.format(alert.date, 'MMM d, yyyy'),
                })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
