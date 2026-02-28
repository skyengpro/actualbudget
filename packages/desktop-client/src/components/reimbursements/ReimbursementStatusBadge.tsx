import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { ReimbursementStatus } from 'loot-core/types/models';

type StatusConfig = {
  backgroundColor: string;
  color: string;
  label: string;
};

type ReimbursementStatusBadgeProps = {
  status: ReimbursementStatus;
};

export function ReimbursementStatusBadge({
  status,
}: ReimbursementStatusBadgeProps) {
  const { t } = useTranslation();

  const statusConfigs: Record<ReimbursementStatus, StatusConfig> = {
    pending: {
      backgroundColor: theme.warningBackground,
      color: theme.warningText,
      label: t('Pending'),
    },
    approved: {
      backgroundColor: theme.noticeBackground,
      color: theme.noticeText,
      label: t('Approved'),
    },
    rejected: {
      backgroundColor: theme.errorBackground,
      color: theme.errorText,
      label: t('Rejected'),
    },
    paid: {
      backgroundColor: theme.noticeBackgroundLight,
      color: theme.noticeTextLight,
      label: t('Paid'),
    },
  };

  const config = statusConfigs[status] || statusConfigs.pending;

  return (
    <View
      style={{
        display: 'inline-flex',
        backgroundColor: config.backgroundColor,
        color: config.color,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <Text style={{ color: config.color }}>{config.label}</Text>
    </View>
  );
}
