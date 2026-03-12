import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AmountInput } from '@desktop-client/components/util/AmountInput';
import type { AccountEntity, CurrencySummary, WhatIfScenario } from 'loot-core/types/models';

import { Page, PageHeader } from '@desktop-client/components/Page';
import { useReport } from '@desktop-client/components/reports/useReport';
import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { useLocalPref } from '@desktop-client/hooks/useLocalPref';

import { BudgetComparison } from './BudgetComparison';
import { CashFlowTable } from './CashFlowTable';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { ForecastAlerts } from './ForecastAlerts';
import { ForecastChart } from './ForecastChart';
import { IncomeExpenseChart } from './IncomeExpenseChart';
import { PatternsList } from './PatternsList';
import { createForecastSpreadsheet } from './spreadsheet';
import { WhatIfPanel } from './WhatIfPanel';

type ForecastDays = 30 | 60 | 90;
type ForecastTab = 'overview' | 'budget' | 'patterns' | 'whatif';

function AccountChip({
  name,
  isSelected,
  onToggle,
}: {
  name: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      onClick={onToggle}
      style={{
        padding: '4px 10px',
        borderRadius: 4,
        border: `1px solid ${isSelected ? theme.pageTextLink : theme.tableBorder}`,
        backgroundColor: isSelected ? `${theme.pageTextLink}15` : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: isSelected ? 500 : 400,
          color: isSelected ? theme.pageTextLink : theme.pageTextSubdued,
        }}
      >
        {name}
      </Text>
    </View>
  );
}

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
    <View
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
        <View
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '4px 12px',
            borderRadius: 3,
            backgroundColor: value === option.value ? theme.pageBackground : 'transparent',
            boxShadow: value === option.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: value === option.value ? 600 : 400,
              color: value === option.value ? theme.pageText : theme.pageTextSubdued,
            }}
          >
            {option.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SummaryCard({
  title,
  value,
  isPositive,
  isNegative,
  compact = false,
  subtitle,
}: {
  title: string;
  value: number;
  isPositive?: boolean;
  isNegative?: boolean;
  compact?: boolean;
  subtitle?: string;
}) {
  const format = useFormat();

  // Determine color based on value sign if colorize is enabled
  const shouldColorize = isPositive || isNegative;
  const textColor = shouldColorize
    ? value > 0
      ? theme.noticeTextLight
      : value < 0
        ? theme.errorText
        : theme.pageText
    : theme.pageText;

  const formattedValue = format(value, 'financial');

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: compact ? 'center' : 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: compact ? 10 : 12,
          fontWeight: 500,
          color: theme.pageTextSubdued,
          marginBottom: compact ? 4 : 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: compact ? 16 : 22,
          fontWeight: 700,
          color: textColor,
          ...styles.monoText,
          lineHeight: 1.2,
        }}
      >
        {formattedValue}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 11,
            color: theme.pageTextSubdued,
            marginTop: 6,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function CurrencySummaryCard({ summary, format }: { summary: CurrencySummary; format: ReturnType<typeof useFormat> }) {
  const { t } = useTranslation();
  const netChange = summary.income + summary.expenses;
  const isPositiveChange = netChange > 0;
  const isNegativeChange = netChange < 0;

  return (
    <View
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${theme.tableBorder}`,
        minWidth: 200,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: theme.pageText,
          }}
        >
          {summary.currency}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: isPositiveChange
              ? theme.noticeTextLight
              : isNegativeChange
                ? theme.errorText
                : theme.pageTextSubdued,
          }}
        >
          {format(netChange, 'financial-with-sign')}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {t('Starting')}
          </Text>
          <Text style={{ fontSize: 13, ...styles.monoText }}>
            {format(summary.starting, 'financial')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {t('Ending')}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: 600,
              color:
                summary.ending < summary.starting
                  ? theme.errorText
                  : theme.pageText,
              ...styles.monoText,
            }}
          >
            {format(summary.ending, 'financial')}
          </Text>
        </View>
        <View
          style={{
            borderTop: `1px solid ${theme.tableBorder}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: theme.noticeTextLight }}>
              {t('Income')}
            </Text>
            <Text
              style={{ fontSize: 12, color: theme.noticeTextLight, ...styles.monoText }}
            >
              +{format(summary.income, 'financial')}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: theme.errorText }}>
              {t('Expenses')}
            </Text>
            <Text
              style={{ fontSize: 12, color: theme.errorText, ...styles.monoText }}
            >
              {format(summary.expenses, 'financial')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function InsightCard({
  title,
  children,
  noPadding = false,
}: {
  title: string;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: theme.pageTextSubdued,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 8,
          border: `1px solid ${theme.tableBorder}`,
          overflow: 'hidden',
          padding: noPadding ? 0 : 16,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 0,
        borderBottom: `2px solid ${theme.tableBorder}`,
        backgroundColor: theme.tableBackground,
        borderRadius: '6px 6px 0 0',
        padding: '0 4px',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '14px 24px',
              cursor: 'pointer',
              borderBottom: isActive ? `3px solid ${theme.pageTextLink}` : '3px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s ease',
              backgroundColor: isActive ? theme.pageBackground : 'transparent',
              borderRadius: '6px 6px 0 0',
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? theme.pageText : theme.pageTextSubdued,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ForecastPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const { isNarrowWidth } = useResponsive();

  // Saved preferences
  const [savedThreshold, setSavedThreshold] = useLocalPref('forecast.lowBalanceThreshold');
  const [savedDays, setSavedDays] = useLocalPref('forecast.forecastDays');

  // Config state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<ForecastTab>('overview');

  // Pattern detection state
  const [includePatterns, setIncludePatterns] = useState(false);
  const [patternConfidenceThreshold, setPatternConfidenceThreshold] = useState(0.7);

  // What-If scenario state
  const [scenario, setScenario] = useState<WhatIfScenario | null>(null);

  const forecastDays: ForecastDays = savedDays || 30;
  const baseCurrency = format.currency.code || 'USD';
  const lowBalanceThreshold = savedThreshold ?? 50000; // Default 500.00 in cents

  // Update selected accounts when accounts load
  React.useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds(
        accounts.filter(a => !a.closed && !a.offbudget).map(a => a.id),
      );
    }
  }, [accounts]);

  const getForecastData = useMemo(
    () =>
      createForecastSpreadsheet({
        accountIds: selectedAccountIds,
        forecastDays,
        lowBalanceThreshold,
        baseCurrency,
        includePatterns,
        patternConfidenceThreshold,
        scenario,
      }),
    [
      selectedAccountIds,
      forecastDays,
      lowBalanceThreshold,
      baseCurrency,
      includePatterns,
      patternConfidenceThreshold,
      scenario,
    ],
  );

  const data = useReport('financial-forecast', getForecastData);

  const daysOptions: Array<[string, string]> = [
    ['30', t('30 days')],
    ['60', t('60 days')],
    ['90', t('90 days')],
  ];

  const handleDaysChange = (value: string) => {
    const num = parseInt(value, 10);
    if (num === 30 || num === 60 || num === 90) {
      setSavedDays(num);
    }
  };

  const hasMultipleCurrencies =
    data?.currencySummaries && data.currencySummaries.length > 1;

  // Get all scheduled items for WhatIfPanel
  const allScheduledItems = useMemo(() => {
    if (!data?.dailyBalances) return [];
    return data.dailyBalances.flatMap(entry =>
      entry.scheduledItems.map(item => ({
        scheduleId: item.scheduleId,
        payeeName: item.payeeName,
        amount: item.amount,
      })),
    );
  }, [data?.dailyBalances]);

  return (
    <Page header={<PageHeader title={t('Financial Forecast')} />}>
      {/* Configuration Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 0',
          marginBottom: 12,
        }}
      >
        {/* Accounts */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 12, color: theme.pageTextSubdued, flexShrink: 0 }}>
            {t('Accounts:')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {accounts.filter(a => !a.closed && !a.offbudget).map(account => (
              <AccountChip
                key={account.id}
                name={account.name}
                isSelected={selectedAccountIds.includes(account.id)}
                onToggle={() => {
                  if (selectedAccountIds.includes(account.id)) {
                    setSelectedAccountIds(selectedAccountIds.filter(id => id !== account.id));
                  } else {
                    setSelectedAccountIds([...selectedAccountIds, account.id]);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Settings - responsive wrap */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <SegmentedControl
            options={[
              { value: '30', label: '30d' },
              { value: '60', label: '60d' },
              { value: '90', label: '90d' },
            ]}
            value={String(forecastDays)}
            onChange={handleDaysChange}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 4,
              overflow: 'hidden',
              border: `1px solid ${theme.tableBorder}`,
            }}
            title={t('You will be warned when your projected balance falls below this amount.')}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                backgroundColor: theme.tableRowBackgroundHover,
                borderRight: `1px solid ${theme.tableBorder}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: theme.warningText,
                }}
              >
                ⚠
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: theme.pageTextSubdued,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('Alert below')}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: theme.tableBackground,
                padding: '5px 10px',
                minWidth: 100,
              }}
            >
              <AmountInput
                value={lowBalanceThreshold}
                sign="+"
                onUpdate={value => setSavedThreshold(Math.abs(value))}
                inputStyle={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  width: '100%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Tabs */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: theme.pageBackground,
          marginLeft: -20,
          marginRight: -20,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 16,
          marginBottom: 8,
        }}
      >
        <TabBar
          tabs={[
            { id: 'overview', label: t('Overview') },
            { id: 'budget', label: isNarrowWidth ? t('Budget') : t('Budget vs Forecast') },
            { id: 'patterns', label: t('Patterns') },
            { id: 'whatif', label: t('What-If') },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as ForecastTab)}
        />
      </div>

      {/* Content */}
      {!data ? (
        <View style={{ flex: 1, alignItems: 'center', padding: 40 }}>
          <Text style={{ color: theme.pageTextSubdued }}>
            {selectedAccountIds.length === 0
              ? t('Select at least one account to see forecast')
              : t('Loading forecast...')}
          </Text>
        </View>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'block' }}>
              {/* KPI Cards Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: data.alerts.length > 0 ? 20 : 0,
                }}
              >
                <div
                  style={{
                    backgroundColor: theme.tableBackground,
                    borderRadius: 8,
                    border: `1px solid ${theme.tableBorder}`,
                    padding: 16,
                  }}
                >
                  <SummaryCard
                    title={t('Current Balance')}
                    value={data.startingBalance}
                    subtitle={t('Today')}
                    compact={isNarrowWidth}
                  />
                </div>
                <div
                  style={{
                    backgroundColor: theme.tableBackground,
                    borderRadius: 8,
                    border: `1px solid ${theme.tableBorder}`,
                    padding: 16,
                  }}
                >
                  <SummaryCard
                    title={t('Projected')}
                    value={data.endingBalance}
                    isPositive={data.endingBalance > data.startingBalance}
                    isNegative={data.endingBalance < data.startingBalance}
                    subtitle={t('In {{days}} days', { days: forecastDays })}
                    compact={isNarrowWidth}
                  />
                </div>
                <div
                  style={{
                    backgroundColor: theme.tableBackground,
                    borderRadius: 8,
                    border: `1px solid ${theme.tableBorder}`,
                    padding: 16,
                  }}
                >
                  <SummaryCard
                    title={t('Income')}
                    value={data.totalIncome}
                    isPositive
                    compact={isNarrowWidth}
                  />
                </div>
                <div
                  style={{
                    backgroundColor: theme.tableBackground,
                    borderRadius: 8,
                    border: `1px solid ${theme.tableBorder}`,
                    padding: 16,
                  }}
                >
                  <SummaryCard
                    title={t('Expenses')}
                    value={data.totalExpenses}
                    isNegative
                    compact={isNarrowWidth}
                  />
                </div>
              </div>

              {/* Alerts Section - always below KPI cards */}
              {data.alerts.length > 0 && (
                <div style={{ display: 'block' }}>
                  <ForecastAlerts alerts={data.alerts} />
                </div>
              )}

              {/* Per-Currency Breakdown (if multiple currencies) */}
              {hasMultipleCurrencies && (
                <div style={{ display: 'block', marginTop: 24 }}>
                  <InsightCard title={t('Currency Breakdown')}>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                      {data.currencySummaries.map(summary => (
                        <CurrencySummaryCard key={summary.currency} summary={summary} format={format} />
                      ))}
                    </div>
                  </InsightCard>
                </div>
              )}

              {/* Balance Projection Chart */}
              <div style={{ display: 'block', marginTop: 24 }}>
                <InsightCard title={t('Balance Projection ({{currency}})', { currency: baseCurrency })}>
                  <ForecastChart
                    data={data.dailyBalances}
                    lowBalanceThreshold={lowBalanceThreshold}
                    baseCurrency={baseCurrency}
                  />
                </InsightCard>
              </div>

              {/* Income vs Expense Chart */}
              <div style={{ display: 'block', marginTop: 24 }}>
                <InsightCard title={t('Income vs Expenses')}>
                  <IncomeExpenseChart data={data.dailyBalances} groupBy="week" />
                </InsightCard>
              </div>

              {/* Cash Flow Table */}
              <div style={{ display: 'block', marginTop: 24, paddingBottom: 20 }}>
                <InsightCard title={t('Upcoming Cash Flow')} noPadding>
                  <CashFlowTable
                    data={data.dailyBalances}
                    maxHeight={400}
                  />
                </InsightCard>
              </div>
            </div>
          )}

          {/* Budget vs Forecast Tab */}
          {activeTab === 'budget' && (
            <View style={{ gap: 16, paddingBottom: 20 }}>
              <InsightCard title={t('Budget vs Forecast Comparison')}>
                {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
                  <BudgetComparison data={data.categoryBreakdown} />
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: theme.pageTextSubdued }}>
                      {t('No category data available. Assign categories to your scheduled transactions.')}
                    </Text>
                  </View>
                )}
              </InsightCard>

              {/* Category Donut Chart */}
              {data.categoryBreakdown && data.categoryBreakdown.length > 0 && (
                <InsightCard title={t('Expense Distribution')}>
                  <CategoryBreakdownChart
                    data={data.categoryBreakdown}
                    showBudgetComparison
                  />
                </InsightCard>
              )}
            </View>
          )}

          {/* Patterns Tab */}
          {activeTab === 'patterns' && (
            <View style={{ gap: 16, paddingBottom: 20 }}>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 16,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${theme.tableBorder}`,
                }}
              >
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>{t('Include in forecast:')}</Text>
                  <SegmentedControl
                    options={[
                      { value: 'off', label: t('Off') },
                      { value: 'on', label: t('On') },
                    ]}
                    value={includePatterns ? 'on' : 'off'}
                    onChange={v => setIncludePatterns(v === 'on')}
                  />
                </View>

                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>{t('Min confidence:')}</Text>
                  <SegmentedControl
                    options={[
                      { value: '0.5', label: '50%' },
                      { value: '0.7', label: '70%' },
                      { value: '0.9', label: '90%' },
                    ]}
                    value={String(patternConfidenceThreshold)}
                    onChange={v => setPatternConfidenceThreshold(parseFloat(v))}
                  />
                </View>
              </View>

              <InsightCard title={t('Detected Patterns')}>
                <PatternsList
                  patterns={data.detectedPatterns || []}
                  confidenceThreshold={patternConfidenceThreshold}
                />
              </InsightCard>
            </View>
          )}

          {/* What-If Tab */}
          {activeTab === 'whatif' && (
            <View style={{ gap: 16, paddingBottom: 20 }}>

              <WhatIfPanel
                scenario={scenario}
                onScenarioChange={setScenario}
                scheduledItems={allScheduledItems}
                scenarioComparison={data.scenarioComparison}
              />

              {/* Show the chart with scenario applied */}
              {scenario && (
                <InsightCard title={t('Scenario Balance Projection')}>
                  <ForecastChart
                    data={data.dailyBalances}
                    lowBalanceThreshold={lowBalanceThreshold}
                    baseCurrency={baseCurrency}
                  />
                </InsightCard>
              )}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
