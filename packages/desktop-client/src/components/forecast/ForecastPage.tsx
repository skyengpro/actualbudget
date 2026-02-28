import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AmountInput } from '@desktop-client/components/util/AmountInput';
import type { AccountEntity, CurrencySummary } from 'loot-core/types/models';

import { Page, PageHeader } from '@desktop-client/components/Page';
import { useReport } from '@desktop-client/components/reports/useReport';
import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { useLocalPref } from '@desktop-client/hooks/useLocalPref';

import { CurrencyAmount } from '@desktop-client/components/common/CurrencyAmount';

import { CashFlowTable } from './CashFlowTable';
import { ForecastAlerts } from './ForecastAlerts';
import { ForecastChart } from './ForecastChart';
import { createForecastSpreadsheet } from './spreadsheet';

type ForecastDays = 30 | 60 | 90;

function AccountSelector({
  accounts,
  selectedIds,
  onChange,
}: {
  accounts: AccountEntity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();

  const onBudgetAccounts = accounts.filter(a => !a.closed && !a.offbudget);

  const toggleAccount = (accountId: string) => {
    if (selectedIds.includes(accountId)) {
      onChange(selectedIds.filter(id => id !== accountId));
    } else {
      onChange([...selectedIds, accountId]);
    }
  };

  const selectAll = () => {
    onChange(onBudgetAccounts.map(a => a.id));
  };

  const selectNone = () => {
    onChange([]);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="bare" onPress={selectAll}>
          <Text style={{ fontSize: 12 }}>{t('Select All')}</Text>
        </Button>
        <Button variant="bare" onPress={selectNone}>
          <Text style={{ fontSize: 12 }}>{t('Clear')}</Text>
        </Button>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {onBudgetAccounts.map(account => {
          const isSelected = selectedIds.includes(account.id);
          return (
            <Button
              key={account.id}
              variant={isSelected ? 'primary' : 'normal'}
              onPress={() => toggleAccount(account.id)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
              }}
            >
              {account.name}
              {account.currency && account.currency !== 'USD' && (
                <Text style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                  ({account.currency})
                </Text>
              )}
            </Button>
          );
        })}
      </View>
    </View>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  isPositive,
  isNegative,
}: {
  title: string;
  value: number;
  subtitle?: string;
  isPositive?: boolean;
  isNegative?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
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
        value={value}
        colorize={isPositive || isNegative}
        amountStyle={{
          fontSize: 22,
          fontWeight: 700,
        }}
        symbolStyle={{
          fontSize: 14,
          opacity: 0.7,
        }}
      />
      {subtitle && (
        <Text
          style={{
            fontSize: 11,
            color: theme.pageTextSubdued,
            marginTop: 4,
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

export function ForecastPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();

  // Saved preferences
  const [savedThreshold, setSavedThreshold] = useLocalPref('forecast.lowBalanceThreshold');
  const [savedDays, setSavedDays] = useLocalPref('forecast.forecastDays');

  // Config state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    return accounts.filter(a => !a.closed && !a.offbudget).map(a => a.id);
  });

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
  }, [accounts, selectedAccountIds.length]);

  const getForecastData = useMemo(
    () =>
      createForecastSpreadsheet({
        accountIds: selectedAccountIds,
        forecastDays,
        lowBalanceThreshold,
        baseCurrency,
      }),
    [selectedAccountIds, forecastDays, lowBalanceThreshold, baseCurrency],
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

  return (
    <Page header={<PageHeader title={t('Financial Forecast')} />}>
      {/* Configuration Section */}
      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 8,
          padding: 16,
          marginTop: 15,
          marginBottom: 20,
          border: `1px solid ${theme.tableBorder}`,
        }}
      >
        <View style={{ gap: 16 }}>
          {/* Account Selection */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 8,
                color: theme.pageText,
              }}
            >
              {t('Accounts to include:')}
            </Text>
            <AccountSelector
              accounts={accounts}
              selectedIds={selectedAccountIds}
              onChange={setSelectedAccountIds}
            />
          </View>

          {/* Days, Threshold, and Base Currency */}
          <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                {t('Forecast period:')}
              </Text>
              <Select
                options={daysOptions}
                value={String(forecastDays)}
                onChange={handleDaysChange}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                {t('Low balance threshold:')}
              </Text>
              <AmountInput
                value={lowBalanceThreshold}
                sign="+"
                onUpdate={value => setSavedThreshold(Math.abs(value))}
                style={{ width: 180 }}
              />
            </View>
          </View>
        </View>
      </View>

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
        <View style={{ gap: 20 }}>
          {/* Converted Totals Summary */}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <SummaryCard
              title={t('Starting Balance')}
              value={data.startingBalance}
              subtitle={t('Current balance')}
            />
            <SummaryCard
              title={t('Ending Balance')}
              value={data.endingBalance}
              subtitle={t('Projected in {{days}} days', { days: forecastDays })}
              isPositive={data.endingBalance > data.startingBalance}
              isNegative={data.endingBalance < data.startingBalance}
            />
            <SummaryCard
              title={t('Total Income')}
              value={data.totalIncome}
              isPositive
            />
            <SummaryCard
              title={t('Total Expenses')}
              value={data.totalExpenses}
              isNegative
            />
          </View>

          {/* Per-Currency Breakdown (if multiple currencies) */}
          {hasMultipleCurrencies && (
            <InsightCard title={t('Currency Breakdown')}>
              <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                {data.currencySummaries.map(summary => (
                  <CurrencySummaryCard key={summary.currency} summary={summary} format={format} />
                ))}
              </View>
            </InsightCard>
          )}

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <InsightCard title={t('Alerts')}>
              <ForecastAlerts alerts={data.alerts} />
            </InsightCard>
          )}

          {/* Balance Projection Chart */}
          <InsightCard title={t('Balance Projection ({{currency}})', { currency: baseCurrency })}>
            <ForecastChart
              data={data.dailyBalances}
              lowBalanceThreshold={lowBalanceThreshold}
              baseCurrency={baseCurrency}
            />
          </InsightCard>

          {/* Cash Flow Table */}
          <InsightCard title={t('Upcoming Cash Flow')}>
            <CashFlowTable
              data={data.dailyBalances}
              maxRows={15}
            />
          </InsightCard>
        </View>
      )}
    </Page>
  );
}
