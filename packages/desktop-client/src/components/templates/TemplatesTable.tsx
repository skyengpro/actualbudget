import React, { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { TransactionTemplateEntity } from 'loot-core/types/models';

import { useCategories } from '@desktop-client/hooks/useCategories';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { usePayees } from '@desktop-client/hooks/usePayees';

type TemplatesTableProps = {
  templates: readonly TransactionTemplateEntity[];
  onEdit: (id: TransactionTemplateEntity['id']) => void;
  onDelete: (id: TransactionTemplateEntity['id']) => void;
};

export const TemplatesTable = memo(function TemplatesTable({
  templates,
  onEdit,
  onDelete,
}: TemplatesTableProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: payees = [] } = usePayees();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.list || [];

  const getPayeeName = (id: string | null | undefined) => {
    if (!id) return '-';
    const payee = payees.find(p => p.id === id);
    return payee?.name || '-';
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return '-';
    const category = categories.find(c => c.id === id);
    return category?.name || '-';
  };

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
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: theme.tableHeaderBackground,
              borderBottom: `1px solid ${theme.tableBorder}`,
            }}
          >
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>
              {t('Name')}
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>
              {t('Payee')}
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>
              {t('Category')}
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, width: 100 }}>
              {t('Amount')}
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, width: 120 }}>
              {t('Actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {templates.map(template => (
            <tr
              key={template.id}
              style={{
                borderBottom: `1px solid ${theme.tableBorder}`,
                cursor: 'pointer',
              }}
              onClick={() => onEdit(template.id)}
            >
              <td style={{ padding: '10px 12px' }}>{template.name}</td>
              <td style={{ padding: '10px 12px' }}>{getPayeeName(template.payee)}</td>
              <td style={{ padding: '10px 12px' }}>{getCategoryName(template.category)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                {template.amount != null ? format(template.amount, 'financial') : '-'}
              </td>
              <td
                style={{ padding: '10px 12px' }}
                onClick={e => e.stopPropagation()}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button variant="bare" onPress={() => onEdit(template.id)}>
                    <Trans>Edit</Trans>
                  </Button>
                  <Button
                    variant="bare"
                    style={{ color: theme.errorText }}
                    onPress={() => onDelete(template.id)}
                  >
                    <Trans>Delete</Trans>
                  </Button>
                </View>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
});
