import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { useFormat, type UseFormatResult } from '@desktop-client/hooks/useFormat';

import type { BudgetImpact, PreviewTransaction } from '../types';

type PreviewSummaryProps = {
  transactions: PreviewTransaction[];
  budgetImpact: BudgetImpact[];
  totalExpenses: number;
  totalIncome: number;
  warnings: string[];
  isNarrowWidth?: boolean;
};

export function PreviewSummary({
  transactions,
  budgetImpact,
  totalExpenses,
  totalIncome,
  warnings,
  isNarrowWidth = false,
}: PreviewSummaryProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const expenseCategories = budgetImpact.filter(c => c.amount < 0);
  const incomeCategories = budgetImpact.filter(c => c.amount > 0);

  return (
    <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <View
          style={{
            padding: '12px 16px',
            backgroundColor: theme.warningText + '15',
            borderRadius: 6,
            border: `1px solid ${theme.warningText}40`,
          }}
        >
          {warnings.map((warning, index) => (
            <Text
              key={index}
              style={{ fontSize: 13, color: theme.warningText }}
            >
              {warning}
            </Text>
          ))}
        </View>
      )}

      {/* Summary Cards */}
      <View
        style={{
          display: 'flex',
          flexDirection: isNarrowWidth ? 'column' : 'row',
          gap: 16,
        }}
      >
        {/* Transaction Count */}
        <SummaryCard
          label={t('Transactions')}
          value={transactions.length.toString()}
          color={theme.pageText}
        />

        {/* Total Expenses */}
        {totalExpenses !== 0 && (
          <SummaryCard
            label={t('Total Expenses')}
            value={format(totalExpenses, 'financial')}
            color={theme.errorText}
          />
        )}

        {/* Total Income */}
        {totalIncome !== 0 && (
          <SummaryCard
            label={t('Total Income')}
            value={format(totalIncome, 'financial')}
            color={theme.pageTextPositive}
          />
        )}
      </View>

      {/* Budget Impact by Category */}
      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 6,
          border: `1px solid ${theme.tableBorder}`,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            padding: '12px 16px',
            backgroundColor: theme.tableHeaderBackground,
            borderBottom: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 600, color: theme.pageText }}>
            <Trans>Budget Impact by Category</Trans>
          </Text>
        </View>

        {budgetImpact.length === 0 ? (
          <View
            style={{
              padding: '20px 16px',
              textAlign: 'center',
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>No budget impact to show</Trans>
          </View>
        ) : (
          <View style={{ padding: '8px 0' }}>
            {/* Expenses Section */}
            {expenseCategories.length > 0 && (
              <>
                <View
                  style={{
                    padding: '8px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: theme.errorText,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <Trans>Expenses</Trans>
                </View>
                {expenseCategories.map(category => (
                  <CategoryRow
                    key={category.categoryId}
                    name={category.categoryName}
                    amount={category.amount}
                    format={format}
                  />
                ))}
              </>
            )}

            {/* Income Section */}
            {incomeCategories.length > 0 && (
              <>
                <View
                  style={{
                    padding: '8px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: theme.pageTextPositive,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginTop: expenseCategories.length > 0 ? 8 : 0,
                  }}
                >
                  <Trans>Income</Trans>
                </View>
                {incomeCategories.map(category => (
                  <CategoryRow
                    key={category.categoryId}
                    name={category.categoryName}
                    amount={category.amount}
                    format={format}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </View>

      {/* Transaction Preview List */}
      <View
        style={{
          backgroundColor: theme.tableBackground,
          borderRadius: 6,
          border: `1px solid ${theme.tableBorder}`,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            padding: '12px 16px',
            backgroundColor: theme.tableHeaderBackground,
            borderBottom: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 600, color: theme.pageText }}>
            <Trans>Transactions to Sync</Trans>
          </Text>
        </View>

        <View style={{ maxHeight: 200, overflow: 'auto' }}>
          {transactions.map((txn, index) => (
            <View
              key={txn.id}
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom:
                  index < transactions.length - 1
                    ? `1px solid ${theme.tableBorder}`
                    : 'none',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: theme.pageText }}>
                  {txn.payee || txn.notes || t('No description')}
                </Text>
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
                    {txn.date}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
                    •
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.pageTextSubdued }}>
                    {txn.categoryName || t('Unknown category')}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: txn.amount < 0 ? theme.errorText : theme.pageTextPositive,
                }}
              >
                {format(txn.amount, 'financial')}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  color: string;
};

function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <View
      style={{
        flex: 1,
        padding: '16px',
        backgroundColor: theme.tableBackground,
        borderRadius: 6,
        border: `1px solid ${theme.tableBorder}`,
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: theme.pageTextSubdued,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'monospace',
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

type CategoryRowProps = {
  name: string;
  amount: number;
  format: UseFormatResult;
};

function CategoryRow({ name, amount, format }: CategoryRowProps) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
      }}
    >
      <Text style={{ fontSize: 13, color: theme.pageText }}>{name}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'monospace',
          color: amount < 0 ? theme.errorText : theme.pageTextPositive,
        }}
      >
        {format(amount, 'financial')}
      </Text>
    </View>
  );
}
