import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import { Pie, PieChart, Sector, Tooltip } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

import type { ForecastCategoryBreakdown } from 'loot-core/types/models';

import { FinancialText } from '@desktop-client/components/FinancialText';
import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { useRechartsAnimation } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { useFormat } from '@desktop-client/hooks/useFormat';

// Color palette for categories
const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c43',
  '#f95d6a',
  '#665191',
  '#2f4b7c',
  '#a05195',
  '#d45087',
  '#ff6e54',
];

type CategoryBreakdownChartProps = {
  data: ForecastCategoryBreakdown[];
  showBudgetComparison?: boolean;
};

type ActiveShapeProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: {
    categoryName: string;
    scheduledAmount: number;
  };
  percent: number;
  value: number;
  format: ReturnType<typeof useFormat>;
};

const RADIAN = Math.PI / 180;

const ActiveShape = (props: ActiveShapeProps) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
    format,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      {/* Center text inside donut */}
      <text
        x={cx}
        y={cy - 16}
        textAnchor="middle"
        fill={fill}
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        {payload.categoryName}
      </text>
      <PrivacyFilter>
        <FinancialText
          as="text"
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={fill}
          style={{ fontSize: 13 }}
        >
          {format(Math.abs(value), 'financial')}
        </FinancialText>
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          fill="#999"
          style={{ fontSize: 12 }}
        >
          ({(percent * 100).toFixed(1)}%)
        </text>
      </PrivacyFilter>
    </g>
  );
};

const CustomTooltip = ({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: Array<{
    payload: ForecastCategoryBreakdown & { fill: string };
    value: number;
  }>;
  format: ReturnType<typeof useFormat>;
}) => {
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
        <div style={{ fontWeight: 600, marginBottom: 8, color: data.fill }}>
          {data.categoryName}
        </div>
        <div style={{ color: theme.menuItemText, lineHeight: 1.6 }}>
          <div>
            {t('Forecasted:')} {format(Math.abs(data.scheduledAmount), 'financial')}
          </div>
          {data.budgetedAmount > 0 && (
            <>
              <div>
                {t('Budgeted:')} {format(data.budgetedAmount, 'financial')}
              </div>
              <div
                style={{
                  color: data.variance >= 0 ? theme.noticeTextLight : theme.errorText,
                }}
              >
                {t('Variance:')} {data.variance >= 0 ? '+' : ''}
                {format(data.variance, 'financial')}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function CategoryBreakdownChart({
  data,
  showBudgetComparison = false,
}: CategoryBreakdownChartProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const animationProps = useRechartsAnimation({ isAnimationActive: false });

  const [activeIndex, setActiveIndex] = useState(0);

  // Filter to expenses only (negative amounts) and add colors
  const chartData = data
    .filter(d => d.scheduledAmount < 0)
    .map((d, index) => ({
      ...d,
      value: Math.abs(d.scheduledAmount),
      fill: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <Container style={{ height: 300 }}>
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
            {t('No expense data to display')}
          </div>
        )}
      </Container>
    );
  }

  return (
    <Container style={{ height: 300 }}>
      {(width, height) => (
        <PieChart width={width} height={height}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={Math.min(width, height) * 0.2}
            outerRadius={Math.min(width, height) * 0.35}
            startAngle={90}
            endAngle={-270}
            {...animationProps}
            shape={(props: PieSectorShapeProps, index: number) => {
              const fill = chartData[index]?.fill ?? props.fill;
              const isActive = props.isActive || index === activeIndex;
              if (isActive && width >= 220 && height >= 130) {
                const shapeProps = {
                  ...props,
                  fill,
                  payload: chartData[index],
                  format,
                } as ActiveShapeProps;
                return <ActiveShape {...shapeProps} />;
              }
              return <Sector {...props} fill={fill} />;
            }}
            onMouseEnter={(_, index) => setActiveIndex(index)}
          />
          <Tooltip
            content={<CustomTooltip format={format} />}
          />
        </PieChart>
      )}
    </Container>
  );
}
