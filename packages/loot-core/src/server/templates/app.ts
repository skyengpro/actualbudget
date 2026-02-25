import { v4 as uuidv4 } from 'uuid';

import { q } from '../../shared/query';
import type { TransactionTemplateEntity } from '../../types/models';
import { addTransactions } from '../accounts/sync';
import { createApp } from '../app';
import { aqlQuery } from '../aql';
import * as db from '../db';
import { mutator } from '../mutators';
import { undoable } from '../undo';

export async function createTemplate({
  template,
}: {
  template: Omit<TransactionTemplateEntity, 'id' | 'active' | 'tombstone'> & {
    id?: string;
  };
}): Promise<TransactionTemplateEntity['id']> {
  const id = template.id || uuidv4();

  if (!template.name) {
    throw new Error('Template name is required');
  }

  await db.insertWithSchema('transaction_templates', {
    ...template,
    id,
    active: 1,
    tombstone: 0,
  });

  return id;
}

export async function updateTemplate({
  id,
  fields,
}: {
  id: TransactionTemplateEntity['id'];
  fields: Partial<Omit<TransactionTemplateEntity, 'id' | 'tombstone'>>;
}) {
  await db.updateWithSchema('transaction_templates', {
    id,
    ...fields,
  });
}

export async function deleteTemplate({
  id,
}: {
  id: TransactionTemplateEntity['id'];
}) {
  await db.updateWithSchema('transaction_templates', {
    id,
    tombstone: 1,
  });
}

export async function listTemplates(): Promise<TransactionTemplateEntity[]> {
  const { data } = await aqlQuery(
    q('transaction_templates')
      .filter({ tombstone: false, active: true })
      .select('*'),
  );
  return data as TransactionTemplateEntity[];
}

export async function applyTemplate({
  id,
  accountId,
  date,
  overrides = {},
}: {
  id: TransactionTemplateEntity['id'];
  accountId: string;
  date: string;
  overrides?: {
    amount?: number;
    notes?: string;
    payee?: string;
    category?: string;
  };
}): Promise<string | null> {
  const { data } = await aqlQuery(
    q('transaction_templates').filter({ id }).select('*'),
  );

  const template = data[0] as TransactionTemplateEntity | undefined;
  if (!template) {
    throw new Error('Template not found');
  }

  const account = accountId || template.account;
  if (!account) {
    throw new Error('Account is required to apply template');
  }

  const transaction = {
    payee: overrides.payee || template.payee || null,
    category: overrides.category || template.category || null,
    amount: overrides.amount ?? template.amount ?? 0,
    notes: overrides.notes || template.notes || null,
    date,
    cleared: false,
  };

  const result = await addTransactions(account, [transaction]);
  return result[0] || null;
}

export type TemplatesHandlers = {
  'template/create': typeof createTemplate;
  'template/update': typeof updateTemplate;
  'template/delete': typeof deleteTemplate;
  'template/list': typeof listTemplates;
  'template/apply': typeof applyTemplate;
};

export const app = createApp<TemplatesHandlers>();

app.method('template/create', mutator(undoable(createTemplate)));
app.method('template/update', mutator(undoable(updateTemplate)));
app.method('template/delete', mutator(undoable(deleteTemplate)));
app.method('template/list', listTemplates);
app.method('template/apply', mutator(undoable(applyTemplate)));
