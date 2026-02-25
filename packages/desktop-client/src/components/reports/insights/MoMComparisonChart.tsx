import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';

import { integerToCurrency } from 'loot-core/shared/util';
import * as monthUtils from 'loot-core/shared/months';

import { useFormat } from '@desktop-client/hooks/useFormat';

import type { MonthlyData } from './spreadsheet';

type MoMComparisonChartProps = {
  data: MonthlyData[];
};

export function MoMComparisonChart({ data }: MoMComparisonChartProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const currentMonth = monthUtils.currentMonth();

  if (data.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No spending data available')}
        </Text>
      </View>
    );
  }

  // Calculate average for reference line (round to integer for currency formatting)
  const average = Math.round(
    data.reduce((sum, d) => sum + d.amount, 0) / Math.max(data.length, 1)
  );

  const chartData = data.map(d => ({
    ...d,
    average,
    isCurrent: d.month === currentMonth,
  }));

  return (
    <View style={{ height: 300, backgroundColor: theme.tableBackground }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.tableBorder}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 12, fill: theme.pageTextSubdued }}
            axisLine={{ stroke: theme.tableBorder }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: theme.pageTextSubdued }}
            axisLine={false}
            tickLine={false}
            tickFormatter={value => format(Math.round(value), 'financial-no-decimals')}
            width={80}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={50}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isCurrent ? '#2563eb' : '#94a3b8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </View>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyData & { average: number } }>;
}) {
  const { t } = useTranslation();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  const diff = data.amount - data.average;
  const diffPercent =
    data.average > 0 ? Math.round((diff / data.average) * 100) : 0;

  return (
    <View
      style={{
        backgroundColor: theme.menuBackground,
        border: `1px solid ${theme.menuBorder}`,
        borderRadius: 6,
        padding: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <Text style={{ fontWeight: 600, marginBottom: 8 }}>{data.monthLabel}</Text>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
          <Text style={{ color: theme.pageTextSubdued }}>{t('Spending:')}</Text>
          <Text style={{ fontWeight: 600 }}>
            {integerToCurrency(data.amount)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
          <Text style={{ color: theme.pageTextSubdued }}>{t('Average:')}</Text>
          <Text>{integerToCurrency(Math.round(data.average))}</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 20,
            marginTop: 4,
            paddingTop: 4,
            borderTop: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text style={{ color: theme.pageTextSubdued }}>{t('vs Avg:')}</Text>
          <Text
            style={{
              color: diff > 0 ? theme.errorText : theme.noticeTextLight,
              fontWeight: 500,
            }}
          >
            {diff > 0 ? '+' : ''}
            {diffPercent}%
          </Text>
        </View>
      </View>
    </View>
  );
}
