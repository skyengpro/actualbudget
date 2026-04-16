import React, { useCallback, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { integerToCurrency } from 'loot-core/shared/util';
import type {
  PriorityItemEntity,
  PriorityItemKind,
  PriorityItemStatus,
} from 'loot-core/types/models';

import { Page } from '@desktop-client/components/Page';
import { useFilePermission } from '@desktop-client/hooks/useFilePermission';
import { usePriorityItems } from '@desktop-client/hooks/usePriorityItems';
import { pushModal } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

function kindLabel(
  kind: PriorityItemKind,
  t: (key: string) => string,
): string {
  switch (kind) {
    case 'purchase':
      return t('Purchase');
    case 'recurring':
      return t('Recurring');
    case 'todo':
      return t('Todo');
    default:
      return kind;
  }
}

function KindBadge({ kind }: { kind: PriorityItemKind }) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: 4,
        backgroundColor: theme.pillBackground,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: theme.pillText,
          textTransform: 'uppercase',
        }}
      >
        {kindLabel(kind, t)}
      </Text>
    </View>
  );
}

type RowActions = {
  onEdit: (id: string) => void;
  onApprove: (item: PriorityItemEntity) => void;
  onDismiss: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onQuickSchedule: (item: PriorityItemEntity) => void;
  onCustomizeSchedule: (item: PriorityItemEntity) => void;
  canWrite: boolean;
  canDelete: boolean;
};

function PriorityItemRow({
  item,
  actions,
}: {
  item: PriorityItemEntity;
  actions: RowActions;
}) {
  const { t } = useTranslation();
  const isPending = item.status === 'pending';
  const isApproved = item.status === 'approved';
  const isDismissed = item.status === 'dismissed';
  const hasAmount = item.amount !== 0;
  // Any approved item with a non-zero amount can be scheduled, regardless of
  // kind. The kind field is informational — a "todo" item like a Marketing
  // Pipeline can still have a real amount + target date and be scheduled.
  const canLinkSchedule = hasAmount;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottom: `1px solid ${theme.tableBorder}`,
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: 600 }}>{item.title}</Text>
          <KindBadge kind={item.kind} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {item.amount !== 0 && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
              {integerToCurrency(item.amount)}
            </Text>
          )}
          {item.target_date && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
              {item.target_date}
            </Text>
          )}
          {item.frequency && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
              {item.frequency}
            </Text>
          )}
          {item.payee_name && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
              {item.payee_name}
            </Text>
          )}
          {item.schedule_id && (
            <Text
              style={{
                color: theme.noticeTextLight,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Trans>Scheduled</Trans>
            </Text>
          )}
        </View>
        {item.notes && (
          <Text
            style={{
              color: theme.pageTextSubdued,
              fontSize: 12,
              fontStyle: 'italic',
            }}
          >
            {item.notes}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {actions.canWrite && isPending && (
          <>
            <Button
              variant="primary"
              onPress={() => actions.onApprove(item)}
            >
              <Trans>Approve</Trans>
            </Button>
            <Button onPress={() => actions.onDismiss(item.id)}>
              <Trans>Dismiss</Trans>
            </Button>
          </>
        )}
        {actions.canWrite && isApproved && (
          <>
            {canLinkSchedule && !item.schedule_id && (
              <>
                <Button
                  variant="primary"
                  onPress={() => actions.onQuickSchedule(item)}
                >
                  <Trans>Quick schedule</Trans>
                </Button>
                <Button
                  variant="bare"
                  onPress={() => actions.onCustomizeSchedule(item)}
                >
                  <Trans>Customize...</Trans>
                </Button>
              </>
            )}
            <Button onPress={() => actions.onReopen(item.id)}>
              <Trans>Reopen</Trans>
            </Button>
          </>
        )}
        {actions.canWrite && isDismissed && (
          <Button
            variant="primary"
            onPress={() => actions.onReopen(item.id)}
          >
            <Trans>Restore</Trans>
          </Button>
        )}
        {actions.canWrite && (
          <Button variant="bare" onPress={() => actions.onEdit(item.id)}>
            <Trans>Edit</Trans>
          </Button>
        )}
        {actions.canDelete && (
          <Button
            variant="bare"
            onPress={() => {
              if (
                window.confirm(
                  t('Delete priority item "{{title}}"?', {
                    title: item.title,
                  }),
                )
              ) {
                actions.onDelete(item.id);
              }
            }}
          >
            <Trans>Delete</Trans>
          </Button>
        )}
      </View>
    </View>
  );
}

function PrioritySection({
  title,
  items,
  emptyMessage,
  actions,
}: {
  title: string;
  items: readonly PriorityItemEntity[];
  emptyMessage?: string;
  actions: RowActions;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: theme.pageTextSubdued,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
        <Text style={{ fontWeight: 400 }}>{` (${items.length})`}</Text>
      </Text>
      <View
        style={{
          border: `1px solid ${theme.tableBorder}`,
          borderRadius: 4,
          backgroundColor: theme.tableBackground,
        }}
      >
        {items.length === 0 ? (
          <View
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.pageTextSubdued,
            }}
          >
            <Text>{emptyMessage}</Text>
          </View>
        ) : (
          items.map(item => (
            <PriorityItemRow key={item.id} item={item} actions={actions} />
          ))
        )}
      </View>
    </View>
  );
}

export function PriorityListPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { canWrite, canDelete } = useFilePermission();

  const { items, isLoading, refresh } = usePriorityItems();

  const grouped = useMemo(() => {
    const byStatus: Record<PriorityItemStatus, PriorityItemEntity[]> = {
      pending: [],
      approved: [],
      dismissed: [],
    };
    for (const item of items) {
      byStatus[item.status]?.push(item);
    }
    return byStatus;
  }, [items]);

  const onAdd = useCallback(() => {
    dispatch(
      pushModal({
        modal: { name: 'priority-item-edit', options: { onSaved: refresh } },
      }),
    );
  }, [dispatch, refresh]);

  const onEdit = useCallback(
    (id: string) => {
      dispatch(
        pushModal({
          modal: {
            name: 'priority-item-edit',
            options: { id, onSaved: refresh },
          },
        }),
      );
    },
    [dispatch, refresh],
  );

  const openScheduleModalForItem = useCallback(
    (item: PriorityItemEntity) => {
      dispatch(
        pushModal({
          modal: {
            name: 'schedule-edit',
            options: {
              template: {
                id: item.id,
                name: item.title,
                amount: item.amount,
                payee: null,
                category: item.category_id,
                notes: item.notes,
                active: true,
                tombstone: false,
              },
              onScheduleCreated: async (scheduleId: string) => {
                // Stamp the schedule_id first so the record retains the link
                // for auditing, then tombstone — the item's no longer in the
                // "planning" stage and now lives under /schedules.
                await send('priority-item/approve', {
                  id: item.id,
                  scheduleId,
                });
                await send('priority-item/delete', { id: item.id });
                refresh();
              },
            },
          },
        }),
      );
    },
    [dispatch, refresh],
  );

  const onApprove = useCallback(
    async (item: PriorityItemEntity) => {
      // Todo items and items with no amount get approved directly. For
      // purchase / recurring items with an amount, approval marks the item
      // approved WITHOUT creating a schedule — the user then chooses
      // "Quick schedule" or "Customize..." to decide how to schedule it.
      await send('priority-item/approve', { id: item.id });
      refresh();
    },
    [refresh],
  );

  const onCustomizeSchedule = useCallback(
    (item: PriorityItemEntity) => {
      openScheduleModalForItem(item);
    },
    [openScheduleModalForItem],
  );

  const onQuickSchedule = useCallback(
    async (item: PriorityItemEntity) => {
      try {
        await send('priority-item/quick-schedule', { id: item.id });
        refresh();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to create schedule';
        window.alert(message);
      }
    },
    [refresh],
  );

  const onDismiss = useCallback(
    async (id: string) => {
      await send('priority-item/dismiss', { id });
      refresh();
    },
    [refresh],
  );

  const onReopen = useCallback(
    async (id: string) => {
      await send('priority-item/reopen', { id });
      refresh();
    },
    [refresh],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await send('priority-item/delete', { id });
      refresh();
    },
    [refresh],
  );

  const actions: RowActions = {
    onEdit,
    onApprove,
    onDismiss,
    onReopen,
    onDelete,
    onQuickSchedule,
    onCustomizeSchedule,
    canWrite,
    canDelete,
  };

  return (
    <Page header={t('Priority List')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: '15px 0',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Plan ahead: list the purchases, subscriptions, and financial
              todos you're considering. Approve items when you decide to
              act on them.
            </Trans>
          </Text>
        </View>
        {canWrite && (
          <Button variant="primary" onPress={onAdd}>
            <Trans>Add item</Trans>
          </Button>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 20, textAlign: 'center' }}>
          <Trans>Loading...</Trans>
        </View>
      ) : (
        <>
          <PrioritySection
            title={t('Pending')}
            items={grouped.pending}
            emptyMessage={t('Nothing pending. Add your first priority item.')}
            actions={actions}
          />
          {grouped.approved.length > 0 && (
            <PrioritySection
              title={t('Approved')}
              items={grouped.approved}
              actions={actions}
            />
          )}
          {grouped.dismissed.length > 0 && (
            <PrioritySection
              title={t('Dismissed')}
              items={grouped.dismissed}
              actions={actions}
            />
          )}
        </>
      )}
    </Page>
  );
}
