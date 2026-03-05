import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InlineField } from '@actual-app/components/inline-field';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { v4 as uuidv4 } from 'uuid';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type { TransactionEntity } from 'loot-core/types/models';

import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useCategories } from '@desktop-client/hooks/useCategories';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { usePayees } from '@desktop-client/hooks/usePayees';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@desktop-client/components/common/Modal';
import { CategoryAutocomplete } from '@desktop-client/components/autocomplete/CategoryAutocomplete';
import { closeModal } from '@desktop-client/modals/modalsSlice';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type SyncOffBudgetModalProps = Extract<
  ModalType,
  { name: 'sync-off-budget' }
>['options'];

type TransactionWithCategory = TransactionEntity & {
  assignedCategory?: string | null;
  selected?: boolean;
};

export function SyncOffBudgetModal({ accountId }: SyncOffBudgetModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();

  const { data: accounts = [] } = useAccounts();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.list || [];
  const { data: payees = [] } = usePayees();

  const [selectedOffBudgetId, setSelectedOffBudgetId] = useState<string>(accountId || '');
  const [selectedOnBudgetId, setSelectedOnBudgetId] = useState<string>('');
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get off-budget accounts
  const offBudgetAccounts = useMemo(() => {
    return accounts.filter(a => a.offbudget && !a.closed);
  }, [accounts]);

  // Get on-budget accounts
  const onBudgetAccounts = useMemo(() => {
    return accounts.filter(a => !a.offbudget && !a.closed);
  }, [accounts]);

  // Load transactions when off-budget account is selected
  useEffect(() => {
    if (!selectedOffBudgetId) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    send('query', q('transactions')
      .filter({ account: selectedOffBudgetId, is_parent: false, tombstone: false })
      .select('*')
      .serialize()
    ).then(({ data }) => {
      // Filter out already synced transactions (notes starting with [SYNCED])
      const unsyncedTxns = (data || []).filter((t: TransactionEntity) =>
        !t.notes?.startsWith('[SYNCED]')
      );
      const txns = unsyncedTxns.map((t: TransactionEntity) => ({
        ...t,
        assignedCategory: t.category || null,
        selected: true,
      }));
      setTransactions(txns);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [selectedOffBudgetId]);

  const toggleTransaction = (id: string) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  };

  const toggleAll = () => {
    const allSelected = transactions.every(t => t.selected);
    setTransactions(prev =>
      prev.map(t => ({ ...t, selected: !allSelected }))
    );
  };

  const updateCategory = (id: string, categoryId: string | null) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, assignedCategory: categoryId } : t)
    );
  };

  const selectedTransactions = transactions.filter(t => t.selected);

  const onSync = async () => {
    setError(null);

    if (!selectedOnBudgetId) {
      setError(t('Please select a destination account'));
      return;
    }

    if (selectedTransactions.length === 0) {
      setError(t('Please select at least one transaction'));
      return;
    }

    // Check if all selected transactions have categories
    const uncategorized = selectedTransactions.filter(t => !t.assignedCategory);
    if (uncategorized.length > 0) {
      setError(t('Please assign categories to all selected transactions'));
      return;
    }

    setIsSyncing(true);

    try {
      // Find the transfer payee for the on-budget account (to create transfer FROM off-budget TO on-budget)
      const onBudgetTransferPayee = payees.find(p => p.transfer_acct === selectedOnBudgetId);

      for (const txn of selectedTransactions) {
        // Step 1: Create the categorized expense in the on-budget account
        // This is the actual expense that affects the budget
        const expenseId = uuidv4();
        await send('transactions-batch-update', {
          added: [{
            id: expenseId,
            account: selectedOnBudgetId,
            date: txn.date,
            amount: txn.amount,
            payee: txn.payee,
            category: txn.assignedCategory,
            notes: txn.notes,
            cleared: false,
          }],
        });

        // Step 2: Create a transfer FROM off-budget TO on-budget
        // This balances the on-budget account (the off-budget account "pays" for the expense)
        // The transfer will automatically create the matching entry in on-budget
        if (onBudgetTransferPayee) {
          const transferId = uuidv4();
          await send('transactions-batch-update', {
            added: [{
              id: transferId,
              account: selectedOffBudgetId,
              date: txn.date,
              amount: txn.amount, // Same amount (negative = money flows out)
              payee: onBudgetTransferPayee.id,
              category: null, // Transfers don't have categories
              notes: '[SYNCED] ' + (txn.notes || ''),
              cleared: true,
              reconciled: true, // Lock the transaction so it can't be modified
            }],
          });
        }

        // Step 3: Delete the original off-budget transaction
        // It's now replaced by the transfer
        await send('transactions-batch-update', {
          deleted: [{ id: txn.id }],
        });
      }

      dispatch(closeModal());
    } catch (err) {
      setError(t('Failed to sync transactions'));
      setIsSyncing(false);
    }
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return t('Select category...');
    const cat = categories.find(c => c.id === id);
    return cat?.name || t('Select category...');
  };

  const totalAmount = selectedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <Modal name="sync-off-budget">
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Sync Off-Budget Transactions')} shrinkOnOverflow />}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ minWidth: 600, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Account Selection */}
            <View style={{ padding: '0 0 16px 0' }}>
              <InlineField label={t('From (Off-Budget)')} width="100%">
                <Select
                  value={selectedOffBudgetId}
                  onChange={(v: string) => setSelectedOffBudgetId(v)}
                  options={[
                    ['', t('Select off-budget account...')],
                    ...offBudgetAccounts.map(a => [a.id, a.name] as const),
                  ]}
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('To (On-Budget)')} width="100%">
                <Select
                  value={selectedOnBudgetId}
                  onChange={(v: string) => setSelectedOnBudgetId(v)}
                  options={[
                    ['', t('Select on-budget account...')],
                    ...onBudgetAccounts.map(a => [a.id, a.name] as const),
                  ]}
                  style={{ flex: 1 }}
                />
              </InlineField>
            </View>

            {/* Transactions List */}
            {selectedOffBudgetId && (
              <View style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontWeight: 600 }}>
                    <Trans>Select transactions to sync:</Trans>
                  </Text>
                  <Button variant="bare" onPress={toggleAll}>
                    {transactions.every(t => t.selected) ? t('Deselect All') : t('Select All')}
                  </Button>
                </View>

                {isLoading ? (
                  <View style={{ padding: 20, textAlign: 'center' }}>
                    <Trans>Loading transactions...</Trans>
                  </View>
                ) : transactions.length === 0 ? (
                  <View style={{ padding: 20, textAlign: 'center', color: theme.pageTextSubdued }}>
                    <Trans>No transactions in this account</Trans>
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      border: `1px solid ${theme.tableBorder}`,
                      borderRadius: 4,
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.tableHeaderBackground }}>
                          <th style={{ padding: 8, width: 40 }}></th>
                          <th style={{ padding: 8, textAlign: 'left' }}>{t('Date')}</th>
                          <th style={{ padding: 8, textAlign: 'left' }}>{t('Payee')}</th>
                          <th style={{ padding: 8, textAlign: 'right' }}>{t('Amount')}</th>
                          <th style={{ padding: 8, textAlign: 'left', minWidth: 180 }}>{t('Category')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(txn => (
                          <tr
                            key={txn.id}
                            style={{
                              borderBottom: `1px solid ${theme.tableBorder}`,
                              backgroundColor: txn.selected ? theme.tableRowBackgroundHover : 'transparent',
                            }}
                          >
                            <td style={{ padding: 8, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={txn.selected}
                                onChange={() => toggleTransaction(txn.id)}
                              />
                            </td>
                            <td style={{ padding: 8 }}>
                              {txn.date}
                            </td>
                            <td style={{ padding: 8 }}>
                              {txn.notes || '-'}
                            </td>
                            <td style={{ padding: 8, textAlign: 'right' }}>
                              {format(txn.amount || 0, 'financial')}
                            </td>
                            <td style={{ padding: 8 }} onClick={e => e.stopPropagation()}>
                              {txn.selected ? (
                                <CategoryAutocomplete
                                  value={txn.assignedCategory}
                                  onSelect={(catId) => updateCategory(txn.id, catId)}
                                />
                              ) : (
                                <Text style={{ color: theme.pageTextSubdued, fontStyle: 'italic' }}>
                                  {getCategoryName(txn.assignedCategory)}
                                </Text>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </View>
                )}

                {/* Summary */}
                {selectedTransactions.length > 0 && (
                  <View
                    style={{
                      marginTop: 12,
                      padding: 12,
                      backgroundColor: theme.tableRowBackgroundHover,
                      borderRadius: 4,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text>
                      <Trans>Selected: {{ count: selectedTransactions.length }} transactions</Trans>
                    </Text>
                    <Text style={{ fontWeight: 600 }}>
                      <Trans>Total: {{ amount: format(totalAmount, 'financial') }}</Trans>
                    </Text>
                  </View>
                )}
              </View>
            )}

            {error && <FormError style={{ marginTop: 10 }}>{error}</FormError>}

            <ModalButtons style={{ marginTop: 16 }}>
              <Button onPress={close}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={onSync}
                isDisabled={isSyncing || selectedTransactions.length === 0}
                style={{ marginLeft: 10 }}
              >
                {isSyncing ? <Trans>Syncing...</Trans> : <Trans>Sync Transactions</Trans>}
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
