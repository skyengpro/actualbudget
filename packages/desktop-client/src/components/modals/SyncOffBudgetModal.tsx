import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
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
  const { isNarrowWidth } = useResponsive();

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

  // Auto-select source account when transactions are loaded
  useEffect(() => {
    if (transactions.length === 0 || selectedOnBudgetId) return;

    // Look for transfers (payee with transfer_acct pointing to an on-budget account)
    for (const txn of transactions) {
      if (txn.payee) {
        const payee = payees.find(p => p.id === txn.payee);
        if (payee?.transfer_acct) {
          const sourceAccount = accounts.find(a => a.id === payee.transfer_acct);
          if (sourceAccount && !sourceAccount.offbudget && !sourceAccount.closed) {
            setSelectedOnBudgetId(sourceAccount.id);
            break;
          }
        }
      }
    }
  }, [transactions, payees, accounts, selectedOnBudgetId]);

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
      for (const txn of selectedTransactions) {
        // Check if original transaction is a transfer (has matching entry in on-budget)
        const txnPayee = payees.find(p => p.id === txn.payee);
        const isTransfer = txnPayee?.transfer_acct != null;

        const absAmount = Math.abs(txn.amount || 0);

        // Sync flow depends on whether original is a transfer or not:
        //
        // If TRANSFER (money came from on-budget):
        // 1. Delete original transfer (this also deletes matching entry in on-budget)
        //    - Off-budget: decreases (transfer IN deleted)
        //    - On-budget: increases (transfer OUT deleted)
        // 2. Create EXPENSE in on-budget with category
        //    - On-budget: decreases (expense)
        //    - Budget: affected
        // Result: Off-budget -X, On-budget +X-X=0, Budget shows expense
        //
        // If NOT TRANSFER (standalone transaction):
        // 1. Delete original
        //    - Off-budget: decreases
        // 2. Create EXPENSE in on-budget with category
        //    - On-budget: decreases
        //    - Budget: affected
        // 3. Create CREDIT to balance on-budget
        //    - On-budget: increases back
        // Result: Off-budget -X, On-budget -X+X=0, Budget shows expense

        // Step 1: Delete original from off-budget
        await send('transactions-batch-update', {
          deleted: [{ id: txn.id }],
        });

        // Step 2: Create EXPENSE (debit) in on-budget with category
        const expenseId = uuidv4();
        await send('transactions-batch-update', {
          added: [{
            id: expenseId,
            account: selectedOnBudgetId,
            date: txn.date,
            amount: -absAmount,
            payee: txn.payee,
            category: txn.assignedCategory,
            notes: txn.notes,
            cleared: true,
          }],
        });

        // Step 3: Only create CREDIT if original was NOT a transfer
        // (If it was a transfer, deleting it already "credited" on-budget)
        if (!isTransfer) {
          const creditId = uuidv4();
          await send('transactions-batch-update', {
            added: [{
              id: creditId,
              account: selectedOnBudgetId,
              date: txn.date,
              amount: absAmount,
              payee: txn.payee,
              category: null,
              notes: '[SYNCED] ' + (txn.notes || ''),
              cleared: true,
            }],
          });
        }
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
          <View style={{
            width: isNarrowWidth ? '100%' : 650,
            maxWidth: '100%',
            maxHeight: '70vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Account Selection - Horizontal Layout */}
            <div
              style={{
                display: 'flex',
                flexDirection: isNarrowWidth ? 'column' : 'row',
                gap: 12,
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: `1px solid ${theme.tableBorder}`,
              }}
            >
              {/* From Account */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${theme.tableBorder}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    backgroundColor: theme.tableRowBackgroundHover,
                    borderRight: `1px solid ${theme.tableBorder}`,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, whiteSpace: 'nowrap' }}>
                    {t('FROM')}
                  </span>
                </div>
                <div style={{ flex: 1, backgroundColor: theme.tableBackground }}>
                  <Select
                    value={selectedOffBudgetId}
                    onChange={(v: string) => setSelectedOffBudgetId(v)}
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
                </div>
              </div>

              {/* Arrow */}
              {!isNarrowWidth && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                  <span style={{ fontSize: 16, color: theme.pageTextSubdued }}>→</span>
                </div>
              )}

              {/* To Account */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${theme.tableBorder}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    backgroundColor: theme.tableRowBackgroundHover,
                    borderRight: `1px solid ${theme.tableBorder}`,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, whiteSpace: 'nowrap' }}>
                    {t('TO')}
                  </span>
                </div>
                <div style={{ flex: 1, backgroundColor: theme.tableBackground }}>
                  <Select
                    value={selectedOnBudgetId}
                    onChange={(v: string) => setSelectedOnBudgetId(v)}
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
                </div>
              </div>
            </div>

            {/* Transactions List */}
            {selectedOffBudgetId && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.pageText }}>
                      {t('Transactions')}
                    </span>
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
                      {transactions.length}
                    </span>
                  </div>
                  <Button variant="bare" onPress={toggleAll}>
                    {transactions.every(t => t.selected) ? t('Deselect All') : t('Select All')}
                  </Button>
                </div>

                {isLoading ? (
                  <div style={{ padding: 30, textAlign: 'center', color: theme.pageTextSubdued }}>
                    {t('Loading transactions...')}
                  </div>
                ) : transactions.length === 0 ? (
                  <div
                    style={{
                      padding: 30,
                      textAlign: 'center',
                      color: theme.pageTextSubdued,
                      backgroundColor: theme.tableBackground,
                      borderRadius: 6,
                      border: `1px dashed ${theme.tableBorder}`,
                    }}
                  >
                    {t('No transactions in this account')}
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      border: `1px solid ${theme.tableBorder}`,
                      borderRadius: 6,
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.tableHeaderBackground }}>
                          <th style={{ padding: '10px 8px', width: 36 }}></th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {t('Date')}
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {t('Description')}
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {t('Amount')}
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: theme.pageTextSubdued, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 160 }}>
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
                              borderBottom: index < transactions.length - 1 ? `1px solid ${theme.tableBorder}` : 'none',
                              backgroundColor: txn.selected ? theme.tableRowBackgroundHover : 'transparent',
                              cursor: 'pointer',
                              transition: 'background-color 0.1s ease',
                            }}
                          >
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={txn.selected}
                                onChange={() => {}}
                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                              />
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: 12, color: theme.pageTextSubdued }}>
                              {txn.date}
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: 13 }}>
                              {txn.notes || <span style={{ color: theme.pageTextSubdued }}>—</span>}
                            </td>
                            <td
                              style={{
                                padding: '10px 8px',
                                textAlign: 'right',
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                color: (txn.amount || 0) < 0 ? theme.errorText : theme.pageTextPositive,
                              }}
                            >
                              {format(txn.amount || 0, 'financial')}
                            </td>
                            <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                              {txn.selected ? (
                                <CategoryAutocomplete
                                  value={txn.assignedCategory}
                                  onSelect={(catId) => updateCategory(txn.id, catId)}
                                />
                              ) : (
                                <span style={{ color: theme.pageTextSubdued, fontSize: 12, fontStyle: 'italic' }}>
                                  {getCategoryName(txn.assignedCategory)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary Footer */}
                {selectedTransactions.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      backgroundColor: theme.tableBackground,
                      borderRadius: 6,
                      border: `1px solid ${theme.tableBorder}`,
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: theme.pageTextSubdued }}>{t('Selected:')}</span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: theme.pageText,
                        }}
                      >
                        {selectedTransactions.length} {t('transactions')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: theme.pageTextSubdued }}>{t('Total:')}</span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: totalAmount < 0 ? theme.errorText : theme.pageTextPositive,
                        }}
                      >
                        {format(totalAmount, 'financial')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  backgroundColor: theme.errorText + '15',
                  borderRadius: 6,
                  border: `1px solid ${theme.errorText}40`,
                }}
              >
                <span style={{ fontSize: 12, color: theme.errorText }}>⚠ {error}</span>
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${theme.tableBorder}`,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <Button
                onPress={close}
                style={{
                  ...(isNarrowWidth && { height: styles.mobileMinHeight, flex: 1 }),
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={onSync}
                isDisabled={isSyncing || selectedTransactions.length === 0}
                style={{
                  ...(isNarrowWidth && { height: styles.mobileMinHeight, flex: 1 }),
                }}
              >
                {isSyncing ? (
                  <Trans>Syncing...</Trans>
                ) : (
                  <>
                    <span style={{ marginRight: 6 }}>↗</span>
                    <Trans>Sync Transactions</Trans>
                  </>
                )}
              </Button>
            </div>
          </View>
        </>
      )}
    </Modal>
  );
}
