import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';

import { PreviewSummary } from '../components/PreviewSummary';
import type { SyncPreviewResult, SyncTransactionInput, WizardAction, WizardState } from '../types';

type PreviewStepProps = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

export function PreviewStep({
  state,
  dispatch,
  onNext,
  onBack,
  onClose,
}: PreviewStepProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load preview when step becomes active
  useEffect(() => {
    if (!state.fromAccountId || !state.toAccountId) return;

    // Build transaction inputs for selected transactions
    const transactionInputs: SyncTransactionInput[] = state.transactions
      .filter(t => state.selectedTransactionIds.has(t.id) && t.assignedCategory)
      .map(t => ({
        id: t.id,
        categoryId: t.assignedCategory!,
      }));

    if (transactionInputs.length === 0) {
      setError(t('No transactions selected for sync'));
      return;
    }

    setIsLoading(true);
    setError(null);

    send('sync-off-budget-preview', {
      fromAccountId: state.fromAccountId,
      toAccountId: state.toAccountId,
      transactions: transactionInputs,
    })
      .then((result: SyncPreviewResult) => {
        dispatch({ type: 'SET_PREVIEW', preview: result });
        setIsLoading(false);
      })
      .catch(err => {
        setError(err?.message || t('Failed to generate preview'));
        setIsLoading(false);
      });
  }, [
    state.fromAccountId,
    state.toAccountId,
    state.transactions,
    state.selectedTransactionIds,
    dispatch,
    t,
  ]);

  const canProceed = state.preview && !isLoading && !error;

  return (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Text style={{ marginBottom: 16, color: theme.pageText }}>
        <Trans>
          Review the budget impact before syncing. This shows how your budget
          categories will be affected.
        </Trans>
      </Text>

      {/* Preview content */}
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
            <Trans>Calculating budget impact...</Trans>
          </View>
        ) : error ? (
          <View
            style={{
              padding: '16px',
              backgroundColor: theme.errorText + '15',
              borderRadius: 6,
              border: `1px solid ${theme.errorText}40`,
            }}
          >
            <Text style={{ fontSize: 13, color: theme.errorText }}>{error}</Text>
          </View>
        ) : state.preview ? (
          <PreviewSummary
            transactions={state.preview.transactions}
            budgetImpact={state.preview.budgetImpact}
            totalExpenses={state.preview.totalExpenses}
            totalIncome={state.preview.totalIncome}
            warnings={state.preview.warnings}
            isNarrowWidth={isNarrowWidth}
          />
        ) : null}
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
            <Trans>Confirm</Trans>
          </Button>
        </View>
      </View>
    </View>
  );
}
