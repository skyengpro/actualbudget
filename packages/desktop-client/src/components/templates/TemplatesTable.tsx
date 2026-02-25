import React, { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { integerToCurrency } from 'loot-core/shared/util';
import type { TransactionTemplateEntity } from 'loot-core/types/models';

import { Table, Row, Cell } from '@desktop-client/components/table';
import { useCategories } from '@desktop-client/hooks/useCategories';
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
  const payees = usePayees();
  const { list: categories } = useCategories();

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
    <View style={{ flex: 1 }}>
      <Table
        headers={[
          { name: 'name', width: 200 },
          { name: 'payee', width: 150 },
          { name: 'category', width: 150 },
          { name: 'amount', width: 100 },
          { name: 'actions', width: 120 },
        ]}
      >
        <Row
          style={{
            fontWeight: 600,
            backgroundColor: theme.tableHeaderBackground,
          }}
        >
          <Cell value={t('Name')} width={200} />
          <Cell value={t('Payee')} width={150} />
          <Cell value={t('Category')} width={150} />
          <Cell value={t('Amount')} width={100} />
          <Cell value={t('Actions')} width={120} />
        </Row>
        {templates.map(template => (
          <Row
            key={template.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onEdit(template.id)}
          >
            <Cell value={template.name} width={200} />
            <Cell value={getPayeeName(template.payee)} width={150} />
            <Cell value={getCategoryName(template.category)} width={150} />
            <Cell
              value={
                template.amount != null
                  ? integerToCurrency(template.amount)
                  : '-'
              }
              width={100}
            />
            <Cell width={120}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  variant="bare"
                  onPress={e => {
                    e.stopPropagation();
                    onEdit(template.id);
                  }}
                >
                  <Trans>Edit</Trans>
                </Button>
                <Button
                  variant="bare"
                  style={{ color: theme.errorText }}
                  onPress={e => {
                    e.stopPropagation();
                    onDelete(template.id);
                  }}
                >
                  <Trans>Delete</Trans>
                </Button>
              </View>
            </Cell>
          </Row>
        ))}
      </Table>
    </View>
  );
});
