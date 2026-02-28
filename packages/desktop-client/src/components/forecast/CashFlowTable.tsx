import React from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type { ForecastEntry } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type CashFlowTableProps = {
  data: ForecastEntry[];
  maxRows?: number;
};

type ScheduledItem = {
  date: string;
  scheduleId: string;
  payeeName: string;
  amount: number;
  accountName: string;
};

export function CashFlowTable({
  data,
  maxRows = 15,
}: CashFlowTableProps) {
  const { t } = useTranslation();
  const format = useFormat();

  // Flatten all scheduled items from all days
  const allItems: ScheduledItem[] = data.flatMap(entry =>
    entry.scheduledItems.map(item => ({
      date: entry.date,
      scheduleId: item.scheduleId,
      payeeName: item.payeeName,
      amount: item.amount,
      accountName: item.accountName || 'Unknown',
    })),
  );

  // Sort by date and take first maxRows
  const displayItems = allItems
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, maxRows);

  if (displayItems.length === 0) {
    return (
      <View
        style={{
          padding: 20,
          alignItems: 'center',
          color: theme.pageTextSubdued,
        }}
      >
        <Text>{t('No upcoming scheduled transactions')}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 0 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          padding: '8px 12px',
          backgroundColor: theme.tableHeaderBackground,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Date')}
        </Text>
        <Text
          style={{
            flex: 2,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Payee')}
        </Text>
        <Text
          style={{
            flex: 1.5,
            fontSize: 12,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Account')}
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
          {t('Amount')}
        </Text>
      </View>

      {/* Rows */}
      {displayItems.map((item, index) => {
        const isIncome = item.amount > 0;
        return (
          <View
            key={`${item.scheduleId}-${item.date}-${index}`}
            style={{
              flexDirection: 'row',
              padding: '10px 12px',
              backgroundColor:
                index % 2 === 0
                  ? theme.tableBackground
                  : theme.tableRowBackgroundHover,
              borderBottom:
                index === displayItems.length - 1
                  ? 'none'
                  : `1px solid ${theme.tableBorder}`,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: theme.pageText,
              }}
            >
              {monthUtils.format(item.date, 'MMM d')}
            </Text>
            <Text
              style={{
                flex: 2,
                fontSize: 13,
                color: theme.pageText,
              }}
            >
              {item.payeeName}
            </Text>
            <Text
              style={{
                flex: 1.5,
                fontSize: 13,
                color: theme.pageTextSubdued,
              }}
            >
              {item.accountName}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'right',
                color: isIncome ? theme.noticeTextLight : theme.errorText,
                ...styles.monoText,
              }}
            >
              {isIncome ? '+' : ''}
              {format(item.amount, 'financial')}
            </Text>
          </View>
        );
      })}

      {allItems.length > maxRows && (
        <View
          style={{
            padding: '10px 12px',
            backgroundColor: theme.tableBackground,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: theme.pageTextSubdued,
              textAlign: 'center',
            }}
          >
            {t('And {{count}} more scheduled transactions...', {
              count: allItems.length - maxRows,
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
