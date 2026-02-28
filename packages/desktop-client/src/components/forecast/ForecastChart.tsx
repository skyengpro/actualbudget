import React from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

type ForecastChartProps = {
  data: ForecastEntry[];
  lowBalanceThreshold: number;
  baseCurrency: string;
};

type TooltipPayload = {
  date: string;
  balance: number;
  income: number;
  expenses: number;
};

function CustomTooltip({
  active,
  payload,
  baseCurrency,
  format,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
  baseCurrency: string;
  format: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formattedDate = monthUtils.format(data.date, 'MMM d, yyyy');

    return (
      <div
        className={css({
          zIndex: 1000,
          pointerEvents: 'none',
          borderRadius: 4,
          boxShadow: '0 1px 6px rgba(0, 0, 0, .20)',
          backgroundColor: theme.menuBackground,
          color: theme.menuItemText,
          padding: 12,
        })}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{formattedDate}</div>
        <div style={{ lineHeight: 1.6 }}>
          <div>
            <span style={{ color: theme.pageTextSubdued }}>
              {t('Balance:')}{' '}
            </span>
            <span style={{ fontWeight: 500 }}>
              {format(data.balance, 'financial')}
            </span>
          </div>
          {data.income > 0 && (
            <div style={{ color: theme.noticeTextLight }}>
              {t('Income:')} +{format(data.income, 'financial')}
            </div>
          )}
          {data.expenses < 0 && (
            <div style={{ color: theme.errorText }}>
              {t('Expenses:')} {format(data.expenses, 'financial')}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function ForecastChart({
  data,
  lowBalanceThreshold,
  baseCurrency,
}: ForecastChartProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const animationProps = useRechartsAnimation();
  const privacyMode = usePrivacyMode();

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Container style={{ height: 350 }}>
        {() => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: theme.pageTextSubdued }}>{t('No data to display')}</span>
          </div>
        )}
      </Container>
    );
  }

  // Use totalBalance (converted to base currency)
  const balances = data.map(d => d.totalBalance || 0);
  const minBalance = Math.min(...balances, lowBalanceThreshold);
  const maxBalance = Math.max(...balances);
  const padding = (maxBalance - minBalance) * 0.1 || 10000;
  const yMin = Math.floor((minBalance - padding) / 10000) * 10000;
  const yMax = Math.ceil((maxBalance + padding) / 10000) * 10000;

  // Format data for chart
  const chartData = data.map(entry => ({
    date: entry.date,
    dateLabel: monthUtils.format(entry.date, 'MMM d'),
    balance: entry.totalBalance,
    income: entry.totalIncome,
    expenses: entry.totalExpenses,
  }));

  // Show fewer tick marks on X axis
  const tickInterval = Math.ceil(data.length / 8);

  return (
    <Container style={{ height: 350 }}>
      {(width, height) => (
        <LineChart
          width={width}
          height={height}
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.tableBorder} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: theme.pageText, fontSize: 11 }}
            tickLine={{ stroke: theme.pageText }}
            interval={tickInterval}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={value => {
              if (privacyMode) return '•••';
              // Convert from cents to actual amount
              const amount = value / 100;
              const absAmount = Math.abs(amount);
              if (absAmount >= 1000000) {
                return `${(amount / 1000000).toFixed(1)}M`;
              }
              if (absAmount >= 1000) {
                return `${(amount / 1000).toFixed(0)}K`;
              }
              return format(value, 'financial');
            }}
            tick={{ fill: theme.pageText, fontSize: 11 }}
            tickLine={{ stroke: theme.pageText }}
            width={70}
          />
          <Tooltip content={<CustomTooltip baseCurrency={baseCurrency} format={format} />} />
          <ReferenceLine
            y={lowBalanceThreshold}
            stroke={theme.warningText}
            strokeDasharray="5 5"
            label={{
              value: t('Threshold'),
              position: 'right',
              fill: theme.warningText,
              fontSize: 11,
            }}
          />
          <ReferenceLine
            y={0}
            stroke={theme.errorText}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={theme.pageTextPositive}
            strokeWidth={2}
            dot={false}
            {...animationProps}
          />
        </LineChart>
      )}
    </Container>
  );
}
