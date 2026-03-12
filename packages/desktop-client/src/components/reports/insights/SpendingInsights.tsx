import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';

import * as monthUtils from 'loot-core/shared/months';

import { CurrencyAmount } from '@desktop-client/components/common/CurrencyAmount';
import { Page, PageHeader } from '@desktop-client/components/Page';
import { useReport } from '@desktop-client/components/reports/useReport';
import { useCategories } from '@desktop-client/hooks/useCategories';
import { useFormat } from '@desktop-client/hooks/useFormat';

import { CategoryTrendsChart } from './CategoryTrendsChart';
import { MoMComparisonChart } from './MoMComparisonChart';
import { SpendingAlerts } from './SpendingAlerts';
import { createSpendingInsightsSpreadsheet } from './spreadsheet';
import { TopPayeesChart } from './TopPayeesChart';

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: theme.tableBackground,
        borderRadius: 4,
        padding: 2,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      {options.map(option => (
        <div
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '6px 14px',
            borderRadius: 3,
            backgroundColor: value === option.value ? theme.pageBackground : 'transparent',
            boxShadow: value === option.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: value === option.value ? 600 : 400,
              color: value === option.value ? theme.pageText : theme.pageTextSubdued,
              whiteSpace: 'nowrap',
            }}
          >
            {option.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SpendingInsights() {
  const { t } = useTranslation();
  const format = useFormat();
  const { isNarrowWidth } = useResponsive();
  const [months, setMonths] = useState(6);
  const [categoryGroupId, setCategoryGroupId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Get categories data
  const { data: categoriesData } = useCategories();
  const categoryGroups = categoriesData?.grouped || [];

  // Ensure months is always a valid number
  const validMonths = Number.isFinite(months) && months > 0 ? months : 6;

  const { startDate, endDate } = useMemo(() => {
    const end = monthUtils.currentMonth();
    const start = monthUtils.subMonths(end, validMonths - 1);
    return { startDate: start, endDate: end };
  }, [validMonths]);

  const getInsightsData = useMemo(
    () =>
      createSpendingInsightsSpreadsheet({
        startDate,
        endDate,
        months: validMonths,
        categoryGroupId,
        categoryId,
      }),
    [startDate, endDate, validMonths, categoryGroupId, categoryId],
  );

  const data = useReport('spending-insights', getInsightsData);

  // Build category group options
  const categoryGroupOptions: Array<[string, string]> = useMemo(() => {
    const options: Array<[string, string]> = [['', t('All Groups')]];
    for (const group of categoryGroups) {
      if (!group.hidden) {
        options.push([group.id, group.name]);
      }
    }
    return options;
  }, [categoryGroups, t]);

  // Build category options based on selected group
  const categoryOptions: Array<[string, string]> = useMemo(() => {
    const options: Array<[string, string]> = [['', t('All Categories')]];

    const groupsToShow = categoryGroupId
      ? categoryGroups.filter(g => g.id === categoryGroupId)
      : categoryGroups;

    for (const group of groupsToShow) {
      if (!group.hidden) {
        for (const cat of group.categories || []) {
          if (!cat.hidden) {
            options.push([cat.id, categoryGroupId ? cat.name : `${group.name}: ${cat.name}`]);
          }
        }
      }
    }
    return options;
  }, [categoryGroups, categoryGroupId, t]);

  const handleMonthsChange = (value: string) => {
    const num = parseInt(value, 10);
    if (Number.isFinite(num) && num > 0) {
      setMonths(num);
    }
  };

  const handleCategoryGroupChange = (value: string) => {
    setCategoryGroupId(value || null);
    setCategoryId(null); // Reset category when group changes
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value || null);
  };

  return (
    <Page
      header={<PageHeader title={t('Spending Insights')} />}
    >
      {/* Configuration Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 0',
          marginBottom: 16,
        }}
      >
        {/* Time Range - Segmented Control */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: theme.pageTextSubdued,
              whiteSpace: 'nowrap',
            }}
          >
            {t('Period:')}
          </span>
          <SegmentedControl
            options={[
              { value: '3', label: '3M' },
              { value: '6', label: '6M' },
              { value: '12', label: '12M' },
            ]}
            value={String(validMonths)}
            onChange={handleMonthsChange}
          />
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {/* Category Group Filter */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 4,
              overflow: 'hidden',
              border: `1px solid ${theme.tableBorder}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                backgroundColor: theme.tableRowBackgroundHover,
                borderRight: `1px solid ${theme.tableBorder}`,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, color: theme.pageTextSubdued }}>
                {t('Group')}
              </span>
            </div>
            <div style={{ backgroundColor: theme.tableBackground }}>
              <Select
                options={categoryGroupOptions}
                value={categoryGroupId || ''}
                onChange={handleCategoryGroupChange}
                style={{
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 4,
              overflow: 'hidden',
              border: `1px solid ${theme.tableBorder}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                backgroundColor: theme.tableRowBackgroundHover,
                borderRight: `1px solid ${theme.tableBorder}`,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, color: theme.pageTextSubdued }}>
                {t('Category')}
              </span>
            </div>
            <div style={{ backgroundColor: theme.tableBackground }}>
              <Select
                options={categoryOptions}
                value={categoryId || ''}
                onChange={handleCategoryChange}
                style={{
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {!data ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <span style={{ color: theme.pageTextSubdued }}>
            {t('Loading insights...')}
          </span>
        </div>
      ) : (
        <div style={{ display: 'block' }}>
          {/* Summary Cards - Responsive Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <SummaryCard
              title={t('This Month')}
              value={data.summary?.thisMonth || 0}
              subtitle={t('Total spending')}
              icon="📊"
            />
            <SummaryCard
              title={t('Last Month')}
              value={data.summary?.lastMonth || 0}
              subtitle={t('Total spending')}
              icon="📅"
            />
            <SummaryCard
              title={t('Monthly Average')}
              value={data.summary?.average || 0}
              subtitle={t('Over {{count}} months', { count: validMonths })}
              icon="📈"
            />
            <SummaryCard
              title={t('Change')}
              value={data.summary?.change || 0}
              subtitle={t('vs last month')}
              isChange
              icon="📉"
            />
          </div>

          {/* Spending Alerts */}
          {data.alerts && data.alerts.length > 0 && (
            <div style={{ display: 'block', marginBottom: 20 }}>
              <SpendingAlerts alerts={data.alerts} />
            </div>
          )}

          {/* Month-over-Month Comparison */}
          <div style={{ display: 'block', marginBottom: 20 }}>
            <InsightCard title={t('Monthly Spending Comparison')}>
              <MoMComparisonChart data={data.monthlyData || []} />
            </InsightCard>
          </div>

          {/* Two Column Layout - Responsive Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
              paddingBottom: 20,
            }}
          >
            {/* Top Payees */}
            <InsightCard title={t('Top Merchants')}>
              <TopPayeesChart data={data.topPayees || []} />
            </InsightCard>

            {/* Category Trends */}
            <InsightCard title={t('Category Trends')}>
              <CategoryTrendsChart
                data={data.categoryTrends || []}
                months={data.months || []}
              />
            </InsightCard>
          </div>
        </div>
      )}
    </Page>
  );
}

function InsightCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.pageText,
            letterSpacing: 0.3,
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  isChange = false,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  isChange?: boolean;
  icon?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: theme.pageTextSubdued,
          }}
        >
          {title}
        </span>
        {icon && (
          <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>
        )}
      </div>
      <CurrencyAmount
        value={isChange ? value : Math.abs(value)}
        showSign={isChange}
        colorize={isChange}
        amountStyle={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
        symbolStyle={{
          fontSize: 13,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: theme.pageTextSubdued,
          marginTop: 6,
        }}
      >
        {subtitle}
      </span>
    </div>
  );
}
