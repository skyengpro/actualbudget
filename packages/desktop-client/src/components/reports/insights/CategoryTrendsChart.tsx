import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import { styles } from '@actual-app/components/styles';

import { integerToCurrency } from 'loot-core/shared/util';
import * as monthUtils from 'loot-core/shared/months';

import { useFormat } from '@desktop-client/hooks/useFormat';

import type { CategoryTrendData } from './spreadsheet';

type CategoryTrendsChartProps = {
  data: CategoryTrendData[];
  months: string[];
};

export function CategoryTrendsChart({ data, months }: CategoryTrendsChartProps) {
  const { t } = useTranslation();
  const format = useFormat();

  if (data.length === 0 || months.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No category data available')}
        </Text>
      </View>
    );
  }

  // Transform data for Recharts - need one object per month with all categories
  const chartData = months.map(month => {
    const monthData: Record<string, string | number> = {
      month,
      monthLabel: monthUtils.format(month, 'MMM'),
    };

    for (const category of data) {
      const monthEntry = category.data.find(d => d.month === month);
      monthData[category.id] = monthEntry?.amount || 0;
    }

    return monthData;
  });

  return (
    <View style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.tableBorder}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: theme.pageTextSubdued }}
            axisLine={{ stroke: theme.tableBorder }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: theme.pageTextSubdued }}
            axisLine={false}
            tickLine={false}
            tickFormatter={value => format(Math.round(value), 'financial-no-decimals')}
            width={60}
          />
          <Tooltip content={<CustomTooltip categories={data} />} />
          <Legend
            content={<CustomLegend categories={data} />}
            verticalAlign="bottom"
            height={36}
          />
          {data.map(category => (
            <Line
              key={category.id}
              type="monotone"
              dataKey={category.id}
              stroke={category.color}
              strokeWidth={2}
              dot={{ r: 3, fill: category.color }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </View>
  );
}

function CustomLegend({ categories }: { categories: CategoryTrendData[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginTop: 8,
      }}
    >
      {categories.map(cat => (
        <View
          key={cat.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <View
            style={{
              width: 12,
              height: 3,
              backgroundColor: cat.color,
              borderRadius: 1,
            }}
          />
          <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
            {cat.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  categories,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  categories: CategoryTrendData[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Sort by value descending
  const sorted = [...payload].sort((a, b) => b.value - a.value);

  return (
    <View
      style={{
        backgroundColor: theme.menuBackground,
        border: `1px solid ${theme.menuBorder}`,
        borderRadius: 6,
        padding: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: 150,
      }}
    >
      <Text style={{ fontWeight: 600, marginBottom: 8 }}>{label}</Text>
      <View style={{ gap: 4 }}>
        {sorted.map(entry => {
          const category = categories.find(c => c.id === entry.dataKey);
          return (
            <View
              key={entry.dataKey}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: entry.color,
                  }}
                />
                <Text style={{ fontSize: 12 }}>
                  {category?.name || entry.dataKey}
                </Text>
              </View>
              <Text style={{ fontSize: 12, ...styles.monoText }}>
                {integerToCurrency(Math.round(entry.value))}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
