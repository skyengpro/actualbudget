import React, { useCallback, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { q } from 'loot-core/shared/query';
import type { TransactionTemplateEntity } from 'loot-core/types/models';

import { TemplatesTable } from './TemplatesTable';

import { Search } from '@desktop-client/components/common/Search';
import { Page } from '@desktop-client/components/Page';
import { useTemplates } from '@desktop-client/hooks/useTemplates';
import { pushModal } from '@desktop-client/modals/modalsSlice';
import { useDispatch } from '@desktop-client/redux';

export function Templates() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [filter, setFilter] = useState('');

  const onEdit = useCallback(
    (id: TransactionTemplateEntity['id']) => {
      dispatch(
        pushModal({ modal: { name: 'template-edit', options: { id } } }),
      );
    },
    [dispatch],
  );

  const onAdd = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'template-edit', options: {} } }));
  }, [dispatch]);

  const onDelete = useCallback(
    async (id: TransactionTemplateEntity['id']) => {
      await send('template/delete', { id });
    },
    [],
  );

  const templatesQuery = useMemo(
    () =>
      q('transaction_templates')
        .filter({ tombstone: false, active: true })
        .select('*'),
    [],
  );

  const { isLoading, templates } = useTemplates({ query: templatesQuery });

  const filteredTemplates = useMemo(() => {
    if (!filter) return templates;
    const lowerFilter = filter.toLowerCase();
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(lowerFilter) ||
        (t.notes && t.notes.toLowerCase().includes(lowerFilter)),
    );
  }, [templates, filter]);

  return (
    <Page header={t('Transaction Templates')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 0 15px',
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'flex-start',
          }}
        >
          <Search
            placeholder={t('Filter templates...')}
            value={filter}
            onChange={setFilter}
          />
        </View>
        <Button variant="primary" onPress={onAdd}>
          <Trans>Add template</Trans>
        </Button>
      </View>

      {isLoading ? (
        <View style={{ padding: 20, textAlign: 'center' }}>
          <Trans>Loading...</Trans>
        </View>
      ) : filteredTemplates.length === 0 ? (
        <View
          style={{
            padding: 20,
            textAlign: 'center',
            color: theme.pageTextSubdued,
          }}
        >
          {filter ? (
            <Trans>No templates match your filter</Trans>
          ) : (
            <Trans>
              No templates yet. Create one to quickly add common transactions.
            </Trans>
          )}
        </View>
      ) : (
        <TemplatesTable
          templates={filteredTemplates}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </Page>
  );
}
