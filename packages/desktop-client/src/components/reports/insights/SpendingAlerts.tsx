import React from 'react';
import { useTranslation } from 'react-i18next';

import { SvgAlertTriangle } from '@actual-app/components/icons/v2';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import { styles } from '@actual-app/components/styles';

import { useFormat } from '@desktop-client/hooks/useFormat';

import type { InsightAlert } from './spreadsheet';

type SpendingAlertsProps = {
  alerts: InsightAlert[];
};

export function SpendingAlerts({ alerts }: SpendingAlertsProps) {
  const { t } = useTranslation();
  const format = useFormat();

  if (alerts.length === 0) {
    return (
      <View style={{ padding: 10, alignItems: 'center' }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No unusual spending patterns detected')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {alerts.map((alert, index) => (
        <AlertItem key={`${alert.categoryId}-${index}`} alert={alert} format={format} />
      ))}
    </View>
  );
}

function AlertItem({ alert, format }: { alert: InsightAlert; format: ReturnType<typeof useFormat> }) {
  const { t } = useTranslation();

  const isIncrease = alert.type === 'increase' || alert.percentChange > 0;
  const bgColor = isIncrease
    ? 'rgba(239, 68, 68, 0.1)' // red tint
    : 'rgba(34, 197, 94, 0.1)'; // green tint
  const borderColor = isIncrease
    ? 'rgba(239, 68, 68, 0.3)'
    : 'rgba(34, 197, 94, 0.3)';
  const iconColor = isIncrease ? theme.errorText : theme.noticeTextLight;

  return (
    <View
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
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isIncrease
            ? 'rgba(239, 68, 68, 0.2)'
            : 'rgba(34, 197, 94, 0.2)',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SvgAlertTriangle width={16} height={16} style={{ color: iconColor }} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 500, marginBottom: 2 }}>{alert.message}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {alert.type === 'increase'
              ? t('Increased by')
              : alert.type === 'decrease'
                ? t('Decreased by')
                : t('Difference:')}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: iconColor,
              ...styles.monoText,
            }}
          >
            {format(Math.abs(alert.amount), 'financial')}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: theme.pageTextSubdued,
              backgroundColor: theme.tableBackground,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {alert.percentChange > 0 ? '+' : ''}
            {alert.percentChange}%
          </Text>
        </View>
      </View>
    </View>
  );
}
