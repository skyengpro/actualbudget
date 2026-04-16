import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type { TransactionEntity } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';
import { usePayees } from '@desktop-client/hooks/usePayees';

import { TransactionTable } from '../components/TransactionTable';
import type { TransactionWithCategory, WizardAction, WizardState } from '../types';

type TransactionStepProps = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

export function TransactionStep({
  state,
  dispatch,
  onNext,
  onBack,
  onClose,
}: TransactionStepProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const { data: payees = [] } = usePayees();
  const [isLoading, setIsLoading] = useState(false);

  // Create payee lookup maps
  const payeeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    payees.forEach(p => {
      map.set(p.id, p.name);
    });
    return map;
  }, [payees]);

  const payeeTransferMap = useMemo(() => {
    const map = new Map<string, string | null>();
    payees.forEach(p => {
      map.set(p.id, p.transfer_acct || null);
    });
    return map;
  }, [payees]);

  // Load transactions when the step becomes active or when from account changes
  useEffect(() => {
    if (!state.fromAccountId) return;

    setIsLoading(true);
    send(
      'query',
      q('transactions')
        .filter({
          account: state.fromAccountId,
          is_parent: false,
          tombstone: false,
        })
        .select('*')
        .serialize(),
    )
      .then(({ data }) => {
        // All non-deleted transactions are available for sync
        const unsyncedTxns = data || [];

        const txns: TransactionWithCategory[] = unsyncedTxns.map(
          (t: TransactionEntity) => ({
            ...t,
            assignedCategory: t.category || null,
            selected: true,
            payeeName: t.payee ? payeeNameMap.get(t.payee) || null : null,
            isTransfer: t.payee ? payeeTransferMap.get(t.payee) != null : false,
          }),
        );

        dispatch({ type: 'SET_TRANSACTIONS', transactions: txns });
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [state.fromAccountId, payeeNameMap, payeeTransferMap, dispatch]);

  const selectedTransactions = state.transactions.filter(t =>
    state.selectedTransactionIds.has(t.id),
  );

  const selectedWithCategory = selectedTransactions.filter(
    t => t.assignedCategory,
  );

  const canProceed =
    selectedTransactions.length > 0 &&
    selectedWithCategory.length === selectedTransactions.length;

  const totalAmount = selectedTransactions.reduce(
    (sum, t) => sum + (t.amount || 0),
    0,
  );

  const expenseAmount = selectedTransactions
    .filter(t => (t.amount || 0) < 0)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const incomeAmount = selectedTransactions
    .filter(t => (t.amount || 0) > 0)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: theme.pageText }}>
            <Trans>Select Transactions</Trans>
          </Text>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: theme.pageTextPositive + '20',
              color: theme.pageTextPositive,
              fontWeight: 600,
            }}
          >
            {state.transactions.length}
          </span>
        </View>
        <Button
          variant="bare"
          onPress={() => dispatch({ type: 'TOGGLE_ALL_TRANSACTIONS' })}
        >
          {state.selectedTransactionIds.size === state.transactions.length
            ? t('Deselect All')
            : t('Select All')}
        </Button>
      </View>

      {/* Transaction list */}
      <View
        style={{
          flex: 1,
          overflow: 'auto',
          marginBottom: 12,
        }}
      >
        {isLoading ? (
          <View
            style={{
              padding: 30,
              textAlign: 'center',
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>Loading transactions...</Trans>
          </View>
        ) : (
          <TransactionTable
            transactions={state.transactions}
            selectedIds={state.selectedTransactionIds}
            dispatch={dispatch}
            isNarrowWidth={isNarrowWidth}
          />
        )}
      </View>

      {/* Summary */}
      {selectedTransactions.length > 0 && (
        <View
          style={{
            padding: '12px 16px',
            backgroundColor: theme.tableBackground,
            borderRadius: 6,
            border: `1px solid ${theme.tableBorder}`,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              display: 'flex',
              flexDirection: isNarrowWidth ? 'column' : 'row',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                <Trans>Selected:</Trans>
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.pageText,
                }}
              >
                {selectedTransactions.length} {t('transactions')}
              </Text>
              {selectedWithCategory.length < selectedTransactions.length && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    backgroundColor: theme.warningText + '20',
                    color: theme.warningText,
                    fontWeight: 600,
                  }}
                >
                  {selectedTransactions.length - selectedWithCategory.length}{' '}
                  {t('uncategorized')}
                </span>
              )}
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', gap: 16 }}>
              {expenseAmount !== 0 && (
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    <Trans>Expenses:</Trans>
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: theme.errorText,
                    }}
                  >
                    {format(expenseAmount, 'financial')}
                  </Text>
                </View>
              )}
              {incomeAmount !== 0 && (
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    <Trans>Income:</Trans>
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: theme.pageTextPositive,
                    }}
                  >
                    {format(incomeAmount, 'financial')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Validation message */}
      {selectedTransactions.length > 0 &&
        selectedWithCategory.length < selectedTransactions.length && (
          <View
            style={{
              padding: '10px 14px',
              backgroundColor: theme.warningText + '15',
              borderRadius: 6,
              border: `1px solid ${theme.warningText}40`,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: theme.warningText }}>
              <Trans>
                Please assign categories to all selected transactions before
                continuing.
              </Trans>
            </Text>
          </View>
        )}

      {/* Footer */}
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 16,
          paddingBottom: 16,
          borderTop: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Button
          onPress={onBack}
          style={{
            ...(isNarrowWidth && { height: styles.mobileMinHeight }),
          }}
        >
          <Trans>Back</Trans>
        </Button>
        <View style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
          <Button
            onPress={onClose}
            style={{
              ...(isNarrowWidth && { height: styles.mobileMinHeight }),
            }}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            onPress={onNext}
            isDisabled={!canProceed}
            style={{
              ...(isNarrowWidth && { height: styles.mobileMinHeight }),
            }}
          >
            <Trans>Preview</Trans>
          </Button>
        </View>
      </View>
    </View>
  );
}
