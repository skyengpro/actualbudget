import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import * as monthUtils from 'loot-core/shared/months';
import type { ForecastEntry } from 'loot-core/types/models';

import { useRechartsAnimation } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { usePrivacyMode } from '@desktop-client/hooks/usePrivacyMode';

type IncomeExpenseChartProps = {
  data: ForecastEntry[];
  groupBy?: 'day' | 'week' | 'month';
};

type ChartDataPoint = {
  label: string;
  income: number;
  expenses: number; // stored as positive for display
  expensesRaw: number; // original negative value
  net: number;
};

type TooltipPayload = ChartDataPoint;

function CustomTooltip({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload; value: number; name: string; color: string }>;
  format: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <div
        className={css({
          backgroundColor: theme.menuBackground,
          padding: 12,
          borderRadius: 4,
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.2)',
        })}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, color: theme.menuItemText }}>
          {data.label}
        </div>
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ color: theme.noticeTextLight }}>
            {t('Income:')} {format(data.income, 'financial')}
          </div>
          <div style={{ color: theme.errorText }}>
            {t('Expenses:')} {format(data.expenses, 'financial')}
          </div>
          <div
            style={{
              color: data.net >= 0 ? theme.noticeTextLight : theme.errorText,
              fontWeight: 500,
              marginTop: 4,
              paddingTop: 4,
              borderTop: `1px solid ${theme.tableBorder}`,
            }}
          >
            {t('Net:')} {data.net >= 0 ? '+' : ''}
            {format(data.net, 'financial')}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function IncomeExpenseChart({
  data,
  groupBy = 'week',
}: IncomeExpenseChartProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const animationProps = useRechartsAnimation();
  const privacyMode = usePrivacyMode();

  // Group data by the specified interval
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const grouped = new Map<string, ChartDataPoint>();

    for (const entry of data) {
      let key: string;
      let label: string;

      if (groupBy === 'day') {
        key = entry.date;
        label = monthUtils.format(entry.date, 'MMM d');
      } else if (groupBy === 'week') {
        // Get week start (Sunday)
        const date = monthUtils.parseDate(entry.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = monthUtils.dayFromDate(weekStart);
        label = `${monthUtils.format(key, 'MMM d')}`;
      } else {
        // month
        key = monthUtils.monthFromDate(entry.date);
        label = monthUtils.format(key + '-01', 'MMM yyyy');
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          label,
          income: 0,
          expenses: 0,
          expensesRaw: 0,
          net: 0,
        });
      }

      const point = grouped.get(key)!;
      point.income += entry.totalIncome;
      point.expensesRaw += entry.totalExpenses;
      point.expenses = Math.abs(point.expensesRaw); // Store as positive for display
      point.net = point.income + point.expensesRaw;
    }

    // Convert to array and sort by key
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [data, groupBy]);

  if (chartData.length === 0) {
    return (
      <Container style={{ height: 320 }}>
        {() => (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.pageTextSubdued,
            }}
          >
            {t('No data to display')}
          </div>
        )}
      </Container>
    );
  }

  // Calculate Y axis domain - both income and expenses are positive now
  const maxIncome = Math.max(...chartData.map(d => d.income), 0);
  const maxExpenses = Math.max(...chartData.map(d => d.expenses), 0);
  const maxValue = Math.max(maxIncome, maxExpenses);
  const padding = maxValue * 0.1;
  const yMax = Math.ceil((maxValue + padding) / 10000) * 10000;

  return (
    <Container style={{ height: 320 }}>
      {(width, height) => (
        <BarChart
          width={width}
          height={height}
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 30 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.tableBorder} />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.pageText, fontSize: 11 }}
            tickLine={{ stroke: theme.pageText }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={value => {
              if (privacyMode) return '•••';
              const amount = value / 100;
              const absAmount = Math.abs(amount);
              if (absAmount >= 1000000) {
                return `${(amount / 1000000).toFixed(1)}M`;
              }
              if (absAmount >= 1000) {
                return `${(amount / 1000).toFixed(0)}K`;
              }
              return format(value, 'financial-no-decimals');
            }}
            tick={{ fill: theme.pageText, fontSize: 11 }}
            tickLine={{ stroke: theme.pageText }}
            width={70}
          />
          <Tooltip content={<CustomTooltip format={format} />} />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: theme.pageText }}>
                {value === 'income' ? t('Income') : t('Expenses')}
              </span>
            )}
          />
          <Bar
            dataKey="income"
            fill={theme.noticeTextLight}
            {...animationProps}
          />
          <Bar
            dataKey="expenses"
            fill={theme.errorText}
            {...animationProps}
          />
        </BarChart>
      )}
    </Container>
  );
}
