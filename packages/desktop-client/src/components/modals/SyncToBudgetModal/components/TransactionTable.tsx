import { Trans, useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { CategoryAutocomplete } from '@desktop-client/components/autocomplete/CategoryAutocomplete';
import { useFormat, type UseFormatResult } from '@desktop-client/hooks/useFormat';

import type { TransactionWithCategory, WizardAction } from '../types';

type TransactionTableProps = {
  transactions: TransactionWithCategory[];
  selectedIds: Set<string>;
  dispatch: React.Dispatch<WizardAction>;
  isNarrowWidth?: boolean;
};

export function TransactionTable({
  transactions,
  selectedIds,
  dispatch,
  isNarrowWidth = false,
}: TransactionTableProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const toggleTransaction = (id: string) => {
    dispatch({ type: 'TOGGLE_TRANSACTION', transactionId: id });
  };

  const updateCategory = (id: string, categoryId: string | null) => {
    dispatch({ type: 'SET_CATEGORY', transactionId: id, categoryId });
  };

  if (transactions.length === 0) {
    return (
      <View
        style={{
          padding: 30,
          textAlign: 'center',
          color: theme.pageTextSubdued,
          backgroundColor: theme.tableBackground,
          borderRadius: 6,
          border: `1px dashed ${theme.tableBorder}`,
        }}
      >
        <Trans>No transactions found in this account</Trans>
      </View>
    );
  }

  if (isNarrowWidth) {
    return (
      <View
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {transactions.map(txn => (
          <TransactionCard
            key={txn.id}
            transaction={txn}
            isSelected={selectedIds.has(txn.id)}
            onToggle={() => toggleTransaction(txn.id)}
            onCategoryChange={categoryId =>
              updateCategory(txn.id, categoryId)
            }
            format={format}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: theme.tableHeaderBackground }}>
            <th style={{ padding: '10px 8px', width: 36 }}></th>
            <th
              style={{
                padding: '10px 8px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: theme.pageTextSubdued,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {t('Date')}
            </th>
            <th
              style={{
                padding: '10px 8px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: theme.pageTextSubdued,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {t('Payee / Notes')}
            </th>
            <th
              style={{
                padding: '10px 8px',
                textAlign: 'right',
                fontSize: 11,
                fontWeight: 600,
                color: theme.pageTextSubdued,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {t('Amount')}
            </th>
            <th
              style={{
                padding: '10px 8px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: theme.pageTextSubdued,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                minWidth: 180,
              }}
            >
              {t('Category')}
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, index) => (
            <tr
              key={txn.id}
              onClick={() => toggleTransaction(txn.id)}
              style={{
                borderBottom:
                  index < transactions.length - 1
                    ? `1px solid ${theme.tableBorder}`
                    : 'none',
                backgroundColor: selectedIds.has(txn.id)
                  ? theme.tableRowBackgroundHover
                  : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.1s ease',
              }}
            >
              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(txn.id)}
                  onChange={() => {}}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  fontSize: 12,
                  color: theme.pageTextSubdued,
                }}
              >
                {txn.date}
              </td>
              <td style={{ padding: '10px 8px', fontSize: 13 }}>
                {txn.payeeName || txn.notes || (
                  <span style={{ color: theme.pageTextSubdued }}>—</span>
                )}
                {txn.isTransfer && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '2px 6px',
                      backgroundColor: theme.tableHeaderBackground,
                      borderRadius: 4,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    {t('Transfer')}
                  </span>
                )}
              </td>
              <td
                style={{
                  padding: '10px 8px',
                  textAlign: 'right',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color:
                    (txn.amount || 0) < 0
                      ? theme.errorText
                      : theme.pageTextPositive,
                }}
              >
                {format(txn.amount || 0, 'financial')}
              </td>
              <td
                style={{ padding: '10px 8px' }}
                onClick={e => e.stopPropagation()}
              >
                {selectedIds.has(txn.id) ? (
                  <CategoryAutocomplete
                    value={txn.assignedCategory}
                    onSelect={catId => updateCategory(txn.id, catId)}
                  />
                ) : (
                  <span
                    style={{
                      color: theme.pageTextSubdued,
                      fontSize: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    {txn.assignedCategory ? t('Assigned') : t('No category')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}

type TransactionCardProps = {
  transaction: TransactionWithCategory;
  isSelected: boolean;
  onToggle: () => void;
  onCategoryChange: (categoryId: string | null) => void;
  format: UseFormatResult;
};

function TransactionCard({
  transaction,
  isSelected,
  onToggle,
  onCategoryChange,
  format,
}: TransactionCardProps) {
  const { t } = useTranslation();
  const amount = transaction.amount || 0;

  return (
    <View
      style={{
        backgroundColor: isSelected
          ? theme.tableRowBackgroundHover
          : theme.tableBackground,
        borderRadius: 8,
        padding: '12px 16px',
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
        onClick={onToggle}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          style={{ cursor: 'pointer', width: 18, height: 18 }}
        />
        <View style={{ flex: 1 }}>
          <View
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: theme.pageText,
              marginBottom: 4,
            }}
          >
            {transaction.payeeName || transaction.notes || t('No description')}
            {transaction.isTransfer && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  padding: '2px 6px',
                  backgroundColor: theme.tableHeaderBackground,
                  borderRadius: 4,
                  color: theme.pageTextSubdued,
                }}
              >
                {t('Transfer')}
              </span>
            )}
          </View>
          <View
            style={{
              fontSize: 12,
              color: theme.pageTextSubdued,
            }}
          >
            {transaction.date}
          </View>
        </View>
        <View
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: amount < 0 ? theme.errorText : theme.pageTextPositive,
          }}
        >
          {format(amount, 'financial')}
        </View>
      </View>

      {isSelected && (
        <View style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <CategoryAutocomplete
            value={transaction.assignedCategory}
            onSelect={catId => onCategoryChange(catId)}
          />
        </View>
      )}
    </View>
  );
}
