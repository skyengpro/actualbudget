import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { useAccounts } from '@desktop-client/hooks/useAccounts';

import type { WizardAction, WizardState } from '../types';

type AccountSelectionStepProps = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onNext: () => void;
  onClose: () => void;
};

export function AccountSelectionStep({
  state,
  dispatch,
  onNext,
  onClose,
}: AccountSelectionStepProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const { data: accounts = [] } = useAccounts();

  // Get off-budget accounts
  const offBudgetAccounts = useMemo(() => {
    return accounts.filter(a => a.offbudget && !a.closed);
  }, [accounts]);

  // Get on-budget accounts
  const onBudgetAccounts = useMemo(() => {
    return accounts.filter(a => !a.offbudget && !a.closed);
  }, [accounts]);

  const canProceed = state.fromAccountId && state.toAccountId;

  return (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Text style={{ marginBottom: 20, color: theme.pageText }}>
        <Trans>
          Select the off-budget account to sync from and the on-budget account
          to sync to. Transactions will be moved and categorized to affect your
          budget.
        </Trans>
      </Text>

      {/* Account Selection - Vertical Layout */}
      <View
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* From Account */}
        <View
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageText,
            }}
          >
            <Trans>From (Off-Budget Account)</Trans>
          </Text>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 6,
              overflow: 'hidden',
              border: `1px solid ${theme.tableBorder}`,
            }}
          >
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                backgroundColor: theme.tableRowBackgroundHover,
                borderRight: `1px solid ${theme.tableBorder}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.pageTextSubdued,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('FROM')}
              </span>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.tableBackground }}>
              <Select
                value={state.fromAccountId || ''}
                onChange={(v: string) =>
                  dispatch({ type: 'SET_FROM_ACCOUNT', accountId: v || null })
                }
                options={[
                  ['', t('Select off-budget account...')],
                  ...offBudgetAccounts.map(a => [a.id, a.name] as const),
                ]}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 0,
                  ...(isNarrowWidth && { height: styles.mobileMinHeight }),
                }}
              />
            </View>
          </View>
          {offBudgetAccounts.length === 0 && (
            <Text
              style={{
                fontSize: 12,
                color: theme.warningText,
                fontStyle: 'italic',
              }}
            >
              <Trans>No off-budget accounts found</Trans>
            </Text>
          )}
        </View>

        {/* Arrow */}
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 20, color: theme.pageTextSubdued }}>↓</span>
        </View>

        {/* To Account */}
        <View
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageText,
            }}
          >
            <Trans>To (On-Budget Account)</Trans>
          </Text>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 6,
              overflow: 'hidden',
              border: `1px solid ${theme.tableBorder}`,
            }}
          >
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                backgroundColor: theme.tableRowBackgroundHover,
                borderRight: `1px solid ${theme.tableBorder}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.pageTextSubdued,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('TO')}
              </span>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.tableBackground }}>
              <Select
                value={state.toAccountId || ''}
                onChange={(v: string) =>
                  dispatch({ type: 'SET_TO_ACCOUNT', accountId: v || null })
                }
                options={[
                  ['', t('Select on-budget account...')],
                  ...onBudgetAccounts.map(a => [a.id, a.name] as const),
                ]}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 0,
                  ...(isNarrowWidth && { height: styles.mobileMinHeight }),
                }}
              />
            </View>
          </View>
          {onBudgetAccounts.length === 0 && (
            <Text
              style={{
                fontSize: 12,
                color: theme.warningText,
                fontStyle: 'italic',
              }}
            >
              <Trans>No on-budget accounts found</Trans>
            </Text>
          )}
        </View>
      </View>

      {/* Info box */}
      <View
        style={{
          padding: 16,
          backgroundColor: theme.tableHeaderBackground,
          borderRadius: 6,
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          <Trans>
            When you sync transactions, they will be moved from your off-budget
            account to your on-budget account with categories applied. This will
            affect your budget and category balances.
          </Trans>
        </Text>
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Footer */}
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 10,
          paddingTop: 16,
          paddingBottom: 16,
          borderTop: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Button
          onPress={onClose}
          style={{
            ...(isNarrowWidth && { height: styles.mobileMinHeight, flex: 1 }),
          }}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          onPress={onNext}
          isDisabled={!canProceed}
          style={{
            ...(isNarrowWidth && { height: styles.mobileMinHeight, flex: 1 }),
          }}
        >
          <Trans>Next</Trans>
        </Button>
      </View>
    </View>
  );
}
