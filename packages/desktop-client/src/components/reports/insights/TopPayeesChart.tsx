import React from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Text } from '@actual-app/components/text';
import { styles } from '@actual-app/components/styles';

import { integerToCurrency } from 'loot-core/shared/util';

import type { PayeeData } from './spreadsheet';

type TopPayeesChartProps = {
  data: PayeeData[];
};

const COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#84cc16', // lime
];

export function TopPayeesChart({ data }: TopPayeesChartProps) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('No payee data available')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {/* Donut Chart */}
      <View style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="amount"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </View>

      {/* Legend */}
      <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
        {data.slice(0, 6).map((payee, index) => (
          <View
            key={payee.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: COLORS[index % COLORS.length],
                flexShrink: 0,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {payee.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.pageTextSubdued,
                ...styles.monoText,
              }}
            >
              {integerToCurrency(payee.amount)}
            </Text>
          </View>
        ))}
        {data.length > 6 && (
          <Text
            style={{
              fontSize: 11,
              color: theme.pageTextSubdued,
              marginTop: 4,
            }}
          >
            {t('+{{count}} more', { count: data.length - 6 })}
          </Text>
        )}
      </View>
    </View>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PayeeData }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <View
      style={{
        backgroundColor: theme.menuBackground,
        border: `1px solid ${theme.menuBorder}`,
        borderRadius: 6,
        padding: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <Text style={{ fontWeight: 600, marginBottom: 4 }}>{data.name}</Text>
      <Text style={{ ...styles.monoText }}>
        {integerToCurrency(data.amount)}
      </Text>
      <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
        {data.percentage}% of total
      </Text>
    </View>
  );
}
