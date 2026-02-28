import React, { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { ReimbursementEntity } from 'loot-core/types/models';

import { useFormat } from '@desktop-client/hooks/useFormat';

import { ReimbursementStatusBadge } from './ReimbursementStatusBadge';

type ReimbursementsTableProps = {
  reimbursements: readonly ReimbursementEntity[];
  onEdit: (id: ReimbursementEntity['id']) => void;
  onDelete: (id: ReimbursementEntity['id']) => void;
  onApprove: (id: ReimbursementEntity['id']) => void;
  onReject: (id: ReimbursementEntity['id']) => void;
  onMarkPaid: (id: ReimbursementEntity['id']) => void;
};

const cellStyle = {
  padding: '10px 8px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

export const ReimbursementsTable = memo(function ReimbursementsTable({
  reimbursements,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onMarkPaid,
}: ReimbursementsTableProps) {
  const { t } = useTranslation();
  const format = useFormat();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.tableBackground,
        borderRadius: 4,
        border: `1px solid ${theme.tableBorder}`,
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.tableHeaderBackground,
          borderBottom: `1px solid ${theme.tableBorder}`,
          fontWeight: 600,
        }}
      >
        <Text style={{ ...cellStyle, width: 100 }}>{t('Date')}</Text>
        <Text style={{ ...cellStyle, width: 150 }}>{t('Employee')}</Text>
        <Text style={{ ...cellStyle, flex: 1, minWidth: 150 }}>
          {t('Description')}
        </Text>
        <Text style={{ ...cellStyle, width: 100, textAlign: 'right' }}>
          {t('Amount')}
        </Text>
        <Text style={{ ...cellStyle, width: 100 }}>{t('Status')}</Text>
        <Text style={{ ...cellStyle, width: 220 }}>{t('Actions')}</Text>
      </View>

      {/* Data Rows */}
      {reimbursements.map(reimbursement => (
        <View
          key={reimbursement.id}
          style={{
            flexDirection: 'row',
            borderBottom: `1px solid ${theme.tableBorder}`,
            cursor: reimbursement.status === 'paid' ? 'default' : 'pointer',
            ':hover': {
              backgroundColor: reimbursement.status === 'paid' ? undefined : theme.tableRowBackgroundHover,
            },
          }}
          onClick={() => reimbursement.status !== 'paid' && onEdit(reimbursement.id)}
        >
          <Text style={{ ...cellStyle, width: 100 }}>
            {reimbursement.date_submitted}
          </Text>
          <Text style={{ ...cellStyle, width: 150 }}>
            {reimbursement.employee_name}
          </Text>
          <Text style={{ ...cellStyle, flex: 1, minWidth: 150 }}>
            {reimbursement.description || '-'}
          </Text>
          <Text style={{ ...cellStyle, width: 100, textAlign: 'right' }}>
            {format(reimbursement.amount, 'financial')}
          </Text>
          <View style={{ ...cellStyle, width: 100 }}>
            <ReimbursementStatusBadge status={reimbursement.status} />
          </View>
          <View
            style={{
              ...cellStyle,
              width: 220,
              flexDirection: 'row',
              gap: 4,
              flexWrap: 'wrap',
            }}
            onClick={e => e.stopPropagation()}
          >
            {reimbursement.status === 'pending' && (
              <>
                <Button
                  variant="bare"
                  style={{ color: theme.noticeTextLight }}
                  onPress={() => onApprove(reimbursement.id)}
                >
                  <Trans>Approve</Trans>
                </Button>
                <Button
                  variant="bare"
                  style={{ color: theme.errorText }}
                  onPress={() => onReject(reimbursement.id)}
                >
                  <Trans>Reject</Trans>
                </Button>
              </>
            )}
            {reimbursement.status === 'approved' && (
              <>
                <Button
                  variant="bare"
                  style={{ color: theme.noticeTextLight }}
                  onPress={() => onMarkPaid(reimbursement.id)}
                >
                  <Trans>Mark Paid</Trans>
                </Button>
                <Button
                  variant="bare"
                  style={{ color: theme.errorText }}
                  onPress={() => onReject(reimbursement.id)}
                >
                  <Trans>Reject</Trans>
                </Button>
              </>
            )}
            {reimbursement.status !== 'paid' && (
              <>
                <Button
                  variant="bare"
                  onPress={() => onEdit(reimbursement.id)}
                >
                  <Trans>Edit</Trans>
                </Button>
                <Button
                  variant="bare"
                  style={{ color: theme.errorText }}
                  onPress={() => onDelete(reimbursement.id)}
                >
                  <Trans>Delete</Trans>
                </Button>
              </>
            )}
            {reimbursement.status === 'paid' && (
              <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                <Trans>Completed</Trans>
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
});
