import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';

import { useFormat } from '@desktop-client/hooks/useFormat';

import { SyncResultNotification } from '../components/SyncResultNotification';
import type { SyncExecuteResult, SyncTransactionInput, WizardAction, WizardState } from '../types';

type ConfirmStepProps = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onBack: () => void;
  onClose: () => void;
};

export function ConfirmStep({
  state,
  dispatch,
  onBack,
  onClose,
}: ConfirmStepProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!state.fromAccountId || !state.toAccountId) return;

    // Build transaction inputs for selected transactions
    const transactionInputs: SyncTransactionInput[] = state.transactions
      .filter(t => state.selectedTransactionIds.has(t.id) && t.assignedCategory)
      .map(t => ({
        id: t.id,
        categoryId: t.assignedCategory!,
      }));

    if (transactionInputs.length === 0) {
      dispatch({
        type: 'SET_ERROR',
        error: {
          type: 'validation',
          message: t('No transactions selected for sync'),
        },
      });
      return;
    }

    setIsSyncing(true);
    dispatch({ type: 'SET_STATUS', status: 'syncing' });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const result: SyncExecuteResult = await send('sync-off-budget-execute', {
        fromAccountId: state.fromAccountId,
        toAccountId: state.toAccountId,
        transactions: transactionInputs,
      });

      dispatch({ type: 'SET_RESULT', result });
      dispatch({
        type: 'SET_STATUS',
        status: result.success ? 'success' : 'error',
      });
    } catch (err) {
      dispatch({
        type: 'SET_RESULT',
        result: {
          success: false,
          syncGroupId: '',
          syncedCount: 0,
          errors: [
            err instanceof Error
              ? err.message
              : t('An unexpected error occurred'),
          ],
        },
      });
      dispatch({ type: 'SET_STATUS', status: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const isComplete = state.status === 'success' || state.status === 'error';

  return (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Content */}
      <View
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {state.result ? (
          <SyncResultNotification result={state.result} />
        ) : (
          <>
            <Text style={{ color: theme.pageText }}>
              <Trans>
                You are about to sync the following transactions to your budget.
                This action can be undone using Cmd/Ctrl + Z.
              </Trans>
            </Text>

            {/* Summary Card */}
            <View
              style={{
                padding: '20px',
                backgroundColor: theme.tableBackground,
                borderRadius: 8,
                border: `1px solid ${theme.tableBorder}`,
              }}
            >
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <SummaryRow
                  label={t('Transactions to sync')}
                  value={
                    state.preview?.transactions.length.toString() ||
                    state.selectedTransactionIds.size.toString()
                  }
                />

                {state.preview && state.preview.totalExpenses !== 0 && (
                  <SummaryRow
                    label={t('Total expenses')}
                    value={format(state.preview.totalExpenses, 'financial')}
                    valueColor={theme.errorText}
                  />
                )}

                {state.preview && state.preview.totalIncome !== 0 && (
                  <SummaryRow
                    label={t('Total income')}
                    value={format(state.preview.totalIncome, 'financial')}
                    valueColor={theme.pageTextPositive}
                  />
                )}

                <View
                  style={{
                    borderTop: `1px solid ${theme.tableBorder}`,
                    paddingTop: 16,
                  }}
                >
                  <SummaryRow
                    label={t('Categories affected')}
                    value={state.preview?.budgetImpact.length.toString() || '0'}
                  />
                </View>
              </View>
            </View>

            {/* Progress indicator */}
            {isSyncing && (
              <View
                style={{
                  padding: '16px',
                  backgroundColor: theme.tableHeaderBackground,
                  borderRadius: 6,
                  textAlign: 'center',
                }}
              >
                <Text style={{ fontSize: 14, color: theme.pageText }}>
                  <Trans>Syncing transactions...</Trans>
                </Text>
                <View
                  style={{
                    marginTop: 12,
                    height: 4,
                    backgroundColor: theme.tableBorder,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: theme.buttonPrimaryBackground,
                      animation: 'progress 1.5s ease-in-out infinite',
                    }}
                  />
                </View>
              </View>
            )}

            {/* Error display */}
            {state.error && (
              <View
                style={{
                  padding: '12px 16px',
                  backgroundColor: theme.errorText + '15',
                  borderRadius: 6,
                  border: `1px solid ${theme.errorText}40`,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.errorText }}>
                  {state.error.message}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

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
        {isComplete ? (
          <View style={{ flex: 1 }} />
        ) : (
          <Button
            onPress={onBack}
            isDisabled={isSyncing}
            style={{
              ...(isNarrowWidth && { height: styles.mobileMinHeight }),
            }}
          >
            <Trans>Back</Trans>
          </Button>
        )}
        <View style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
          {isComplete ? (
            <Button
              variant="primary"
              onPress={onClose}
              style={{
                ...(isNarrowWidth && { height: styles.mobileMinHeight }),
              }}
            >
              <Trans>Done</Trans>
            </Button>
          ) : (
            <>
              <Button
                onPress={onClose}
                isDisabled={isSyncing}
                style={{
                  ...(isNarrowWidth && { height: styles.mobileMinHeight }),
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={handleSync}
                isDisabled={isSyncing}
                style={{
                  ...(isNarrowWidth && { height: styles.mobileMinHeight }),
                }}
              >
                {isSyncing ? (
                  <Trans>Syncing...</Trans>
                ) : (
                  <>
                    <span style={{ marginRight: 6 }}>↗</span>
                    <Trans>Sync to Budget</Trans>
                  </>
                )}
              </Button>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function SummaryRow({ label, value, valueColor }: SummaryRowProps) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>{label}</Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'monospace',
          color: valueColor || theme.pageText,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
