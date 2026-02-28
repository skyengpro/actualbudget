import React, { useCallback, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type {
  ReimbursementEntity,
  ReimbursementStatus,
} from 'loot-core/types/models';

import { ReimbursementsTable } from './ReimbursementsTable';

import { Search } from '@desktop-client/components/common/Search';
import { Page } from '@desktop-client/components/Page';
import { useFilePermission } from '@desktop-client/hooks/useFilePermission';
import { useReimbursements } from '@desktop-client/hooks/useReimbursements';
import { pushModal } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

type StatusFilter = 'all' | ReimbursementStatus;

export function Reimbursements() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { canWrite, canDelete } = useFilePermission();

  // Fetch reimbursements first so we can use them in callbacks
  const reimbursementsQuery = useMemo(
    () =>
      q('reimbursements')
        .filter({ tombstone: false })
        .select('*')
        .orderBy({ date_submitted: 'desc' }),
    [],
  );

  const { isLoading, reimbursements, refresh } = useReimbursements({
    query: reimbursementsQuery,
  });

  const onEdit = useCallback(
    (id: ReimbursementEntity['id']) => {
      dispatch(
        pushModal({
          modal: {
            name: 'reimbursement-edit',
            options: { id, onSave: refresh },
          },
        }),
      );
    },
    [dispatch, refresh],
  );

  const onAdd = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'reimbursement-edit',
          options: { onSave: refresh },
        },
      }),
    );
  }, [dispatch, refresh]);

  const onDelete = useCallback(
    async (id: ReimbursementEntity['id']) => {
      await send('reimbursement/delete', { id });
      refresh();
    },
    [refresh],
  );

  const onApprove = useCallback(
    async (id: ReimbursementEntity['id']) => {
      await send('reimbursement/update-status', { id, status: 'approved' });
      refresh();
    },
    [refresh],
  );

  const onReject = useCallback(
    async (id: ReimbursementEntity['id']) => {
      await send('reimbursement/update-status', { id, status: 'rejected' });
      refresh();
    },
    [refresh],
  );

  const onMarkPaid = useCallback(
    (id: ReimbursementEntity['id']) => {
      const reimbursement = reimbursements.find(r => r.id === id);
      if (!reimbursement) return;

      dispatch(
        pushModal({
          modal: {
            name: 'reimbursement-pay',
            options: {
              id,
              employeeName: reimbursement.employee_name,
              amount: reimbursement.amount,
              onPaid: () => {
                refresh();
              },
            },
          },
        }),
      );
    },
    [dispatch, reimbursements, refresh],
  );

  // Cleanup state
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupMonths, setCleanupMonths] = useState('12');
  const [cleanupStats, setCleanupStats] = useState<{ count: number; cutoffDate: string } | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const fetchCleanupStats = useCallback(async (months: number) => {
    const stats = await send('reimbursement/cleanup-stats', { monthsOld: months });
    setCleanupStats(stats);
  }, []);

  const handleCleanup = useCallback(async () => {
    const months = parseInt(cleanupMonths) || 12;
    if (!window.confirm(t('Are you sure you want to delete {{count}} paid reimbursements older than {{months}} months?', { count: cleanupStats?.count || 0, months }))) {
      return;
    }

    setIsCleaningUp(true);
    try {
      const result = await send('reimbursement/cleanup', { monthsOld: months });
      alert(t('Deleted {{count}} old reimbursements', { count: result.deleted }));
      setShowCleanup(false);
      refresh();
    } catch (e) {
      alert(t('Failed to cleanup reimbursements'));
    } finally {
      setIsCleaningUp(false);
    }
  }, [cleanupMonths, cleanupStats, t, refresh]);

  const filteredReimbursements = useMemo(() => {
    let result = reimbursements;

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Apply text filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        r =>
          r.employee_name.toLowerCase().includes(lowerFilter) ||
          (r.description && r.description.toLowerCase().includes(lowerFilter)),
      );
    }

    return result;
  }, [reimbursements, filter, statusFilter]);

  const statusOptions: Array<[StatusFilter, string]> = [
    ['all', t('All Statuses')],
    ['pending', t('Pending')],
    ['approved', t('Approved')],
    ['rejected', t('Rejected')],
    ['paid', t('Paid')],
  ];

  return (
    <Page header={t('Employee Reimbursements')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: '15px 0',
          gap: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <Search
            placeholder={t('Search by employee or description...')}
            value={filter}
            onChange={setFilter}
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(value: string) =>
              setStatusFilter(value as StatusFilter)
            }
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canDelete && (
            <Button
              variant="bare"
              onPress={() => {
                setShowCleanup(!showCleanup);
                if (!showCleanup) {
                  fetchCleanupStats(parseInt(cleanupMonths) || 12);
                }
              }}
            >
              <Trans>Cleanup</Trans>
            </Button>
          )}
          {canWrite && (
            <Button variant="primary" onPress={onAdd}>
              <Trans>Add Reimbursement</Trans>
            </Button>
          )}
        </View>
      </View>

      {/* Cleanup Panel */}
      {showCleanup && (
        <View
          style={{
            padding: 16,
            marginBottom: 16,
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontWeight: 600, marginBottom: 12 }}>
            <Trans>Cleanup Old Reimbursements</Trans>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text><Trans>Delete paid reimbursements older than</Trans></Text>
            <Input
              type="number"
              value={cleanupMonths}
              onChangeValue={(value) => {
                setCleanupMonths(value);
                const months = parseInt(value);
                if (months > 0) {
                  fetchCleanupStats(months);
                }
              }}
              style={{ width: 60 }}
            />
            <Text><Trans>months</Trans></Text>
          </View>
          {cleanupStats && (
            <Text style={{ marginTop: 8, color: theme.pageTextSubdued }}>
              <Trans>
                Found {{count: cleanupStats.count}} paid reimbursements before {{date: cleanupStats.cutoffDate}}
              </Trans>
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button
              variant="primary"
              isDisabled={isCleaningUp || !cleanupStats?.count}
              onPress={handleCleanup}
            >
              {isCleaningUp ? <Trans>Cleaning...</Trans> : <Trans>Delete Old Records</Trans>}
            </Button>
            <Button variant="bare" onPress={() => setShowCleanup(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: 20, textAlign: 'center' }}>
          <Trans>Loading...</Trans>
        </View>
      ) : filteredReimbursements.length === 0 ? (
        <View
          style={{
            padding: 20,
            textAlign: 'center',
            color: theme.pageTextSubdued,
          }}
        >
          {filter || statusFilter !== 'all' ? (
            <Trans>No reimbursements match your filters</Trans>
          ) : (
            <Trans>
              No reimbursements yet. Create one to track employee expense
              claims.
            </Trans>
          )}
        </View>
      ) : (
        <ReimbursementsTable
          reimbursements={filteredReimbursements}
          onEdit={onEdit}
          onDelete={onDelete}
          onApprove={onApprove}
          onReject={onReject}
          onMarkPaid={onMarkPaid}
        />
      )}
    </Page>
  );
}
