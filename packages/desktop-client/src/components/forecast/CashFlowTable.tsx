import React from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as monthUtils from 'loot-core/shared/months';
import type { ForecastEntry } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

type CashFlowTableProps = {
  data: ForecastEntry[];
  maxHeight?: number;
};

type ScheduledItem = {
  date: string;
  scheduleId: string;
  payeeName: string;
  amount: number;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  isPredicted?: boolean;
};

export function CashFlowTable({
  data,
  maxHeight = 400,
}: CashFlowTableProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { isNarrowWidth } = useResponsive();

  // Flatten all scheduled items from all days
  const allItems: ScheduledItem[] = data.flatMap(entry =>
    entry.scheduledItems.map(item => ({
      date: entry.date,
      scheduleId: item.scheduleId,
      payeeName: item.payeeName,
      amount: item.amount,
      accountName: item.accountName || 'Unknown',
      categoryId: item.categoryId || null,
      categoryName: item.categoryName || null,
      isPredicted: item.scheduleId.startsWith('predicted-'),
    })),
  );

  // Sort by date
  const displayItems = allItems.sort((a, b) => a.date.localeCompare(b.date));

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

  // Define grid columns - balanced proportions
  const gridColumns = isNarrowWidth
    ? '55px 1fr 90px'
    : '70px 1.5fr 1fr 1fr 120px';

  return (
    <View style={{ gap: 0 }}>
      {/* Header */}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: 12,
          padding: '14px 16px',
          backgroundColor: theme.tableHeaderBackground,
          borderBottom: `1px solid ${theme.tableBorder}`,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Date')}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
          }}
        >
          {t('Description')}
        </Text>
        {!isNarrowWidth && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.tableHeaderText,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {t('Category')}
          </Text>
        )}
        {!isNarrowWidth && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.tableHeaderText,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {t('Account')}
          </Text>
        )}
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: theme.tableHeaderText,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          {t('Amount')}
        </Text>
      </View>

      {/* Scrollable Rows */}
      <View
        style={{
          maxHeight,
          overflowY: 'auto',
        }}
      >
        {displayItems.map((item, index) => {
          const isIncome = item.amount > 0;
          const isPredicted = item.isPredicted;
          const description = item.payeeName || item.accountName || t('Scheduled');

          return (
            <View
              key={`${item.scheduleId}-${item.date}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                gap: 12,
                minHeight: 44,
                padding: '0 16px',
                backgroundColor:
                  index % 2 === 0
                    ? theme.tableBackground
                    : theme.tableRowBackgroundHover,
                borderBottom:
                  index === displayItems.length - 1
                    ? 'none'
                    : `1px solid ${theme.tableBorder}`,
                opacity: isPredicted ? 0.7 : 1,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: theme.pageTextSubdued,
                }}
              >
                {monthUtils.format(item.date, 'MMM d')}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.pageText,
                  fontStyle: isPredicted ? 'italic' : 'normal',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {description}
                {isPredicted && ' *'}
              </Text>
              {!isNarrowWidth && (
                <Text
                  style={{
                    fontSize: 13,
                    color: item.categoryName ? theme.pageText : theme.pageTextSubdued,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}
                >
                  {item.categoryName || '—'}
                </Text>
              )}
              {!isNarrowWidth && (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.pageTextSubdued,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}
                >
                  {item.accountName}
                </Text>
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 600,
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
      </View>
    </View>
  );
}
