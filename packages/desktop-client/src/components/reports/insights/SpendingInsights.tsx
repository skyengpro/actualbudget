import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

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

export function SpendingInsights() {
  const { t } = useTranslation();
  const format = useFormat();
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

  const monthOptions: Array<[string, string]> = [
    ['3', t('Last 3 months')],
    ['6', t('Last 6 months')],
    ['12', t('Last 12 months')],
  ];

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 10,
          marginBottom: 20,
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 500 }}>{t('Time range:')}</Text>
          <Select
            options={monthOptions}
            value={String(validMonths)}
            onChange={handleMonthsChange}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 500 }}>{t('Group:')}</Text>
          <Select
            options={categoryGroupOptions}
            value={categoryGroupId || ''}
            onChange={handleCategoryGroupChange}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 500 }}>{t('Category:')}</Text>
          <Select
            options={categoryOptions}
            value={categoryId || ''}
            onChange={handleCategoryChange}
          />
        </View>
      </View>

      {!data ? (
        <View style={{ flex: 1, alignItems: 'center', padding: 40 }}>
          <Text style={{ color: theme.pageTextSubdued }}>
            {t('Loading insights...')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {/* Spending Alerts */}
          {data.alerts && data.alerts.length > 0 && (
            <InsightCard title={t('Spending Alerts')}>
              <SpendingAlerts alerts={data.alerts} />
            </InsightCard>
          )}

          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <SummaryCard
              title={t('This Month')}
              value={data.summary?.thisMonth || 0}
              subtitle={t('Total spending')}
            />
            <SummaryCard
              title={t('Last Month')}
              value={data.summary?.lastMonth || 0}
              subtitle={t('Total spending')}
            />
            <SummaryCard
              title={t('Monthly Average')}
              value={data.summary?.average || 0}
              subtitle={t('Over {{count}} months', { count: validMonths })}
            />
            <SummaryCard
              title={t('Change')}
              value={data.summary?.change || 0}
              subtitle={t('vs last month')}
              isChange
            />
          </View>

          {/* Month-over-Month Comparison */}
          <InsightCard title={t('Monthly Spending Comparison')}>
            <MoMComparisonChart data={data.monthlyData || []} />
          </InsightCard>

          {/* Two Column Layout */}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            {/* Top Payees */}
            <View style={{ flex: 1, minWidth: 300 }}>
              <InsightCard title={t('Top Merchants')}>
                <TopPayeesChart data={data.topPayees || []} />
              </InsightCard>
            </View>

            {/* Category Trends */}
            <View style={{ flex: 1, minWidth: 300 }}>
              <InsightCard title={t('Category Trends')}>
                <CategoryTrendsChart
                  data={data.categoryTrends || []}
                  months={data.months || []}
                />
              </InsightCard>
            </View>
          </View>
        </View>
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
    <View
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: theme.pageTextSubdued,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  isChange = false,
}: {
  title: string;
  value: number;
  subtitle: string;
  isChange?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: theme.pageTextSubdued,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <CurrencyAmount
        value={isChange ? value : Math.abs(value)}
        showSign={isChange}
        colorize={isChange}
        amountStyle={{
          fontSize: 24,
          fontWeight: 700,
        }}
        symbolStyle={{
          fontSize: 14,
          opacity: 0.7,
        }}
      />
      <Text
        style={{
          fontSize: 11,
          color: theme.pageTextSubdued,
          marginTop: 4,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}
