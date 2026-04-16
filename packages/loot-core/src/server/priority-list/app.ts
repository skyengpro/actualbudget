import { v4 as uuidv4 } from 'uuid';

import * as monthUtils from '../../shared/months';
import type {
  NewPriorityItemEntity,
  PriorityItemEntity,
  PriorityItemStatus,
} from '../../types/models';
import { createApp } from '../app';
import * as db from '../db';
import { mutator } from '../mutators';
import { createSchedule } from '../schedules/app';

// Ensure the priority_items table exists. The real schema is installed by the
// 1820000000000_add_priority_items migration; this guard lets the module also
// work on databases that were created before the migration ran (mirrors the
// pattern used in budget-goals/app.ts and budget-scenarios/app.ts).
let tableInitialized = false;
function ensureTable() {
  if (tableInitialized) return;

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS priority_items
      (id TEXT PRIMARY KEY,
       title TEXT NOT NULL,
       kind TEXT NOT NULL DEFAULT 'purchase',
       status TEXT NOT NULL DEFAULT 'pending',
       priority INTEGER NOT NULL DEFAULT 0,
       amount INTEGER NOT NULL DEFAULT 0,
       payee_name TEXT,
       category_id TEXT,
       target_date TEXT,
       frequency TEXT,
       notes TEXT,
       schedule_id TEXT,
       created_at TEXT NOT NULL,
       approved_at TEXT,
       tombstone INTEGER NOT NULL DEFAULT 0)
  `);

  db.execQuery(`
    CREATE INDEX IF NOT EXISTS priority_items_status_priority
      ON priority_items(status, priority)
  `);

  tableInitialized = true;
}

function normalizeRow(row: PriorityItemEntity): PriorityItemEntity {
  return {
    ...row,
    tombstone: row.tombstone ? 1 : 0,
  };
}

function nextPriorityValue(): number {
  const rows = db.runQuery<{ max_priority: number | null }>(
    `SELECT MAX(priority) AS max_priority
       FROM priority_items
      WHERE status = 'pending' AND tombstone = 0`,
    [],
    true,
  );
  const current = rows[0]?.max_priority;
  return current == null ? 0 : current + 1;
}

export async function createPriorityItem({
  item,
}: {
  item: NewPriorityItemEntity;
}): Promise<PriorityItemEntity['id']> {
  ensureTable();

  if (!item.title) {
    throw new Error('Priority item title is required');
  }
  if (!item.kind) {
    throw new Error('Priority item kind is required');
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const priority =
    typeof item.priority === 'number' ? item.priority : nextPriorityValue();

  db.runQuery(
    `INSERT INTO priority_items
       (id, title, kind, status, priority, amount,
        payee_name, category_id, target_date, frequency, notes,
        schedule_id, created_at, approved_at, tombstone)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0)`,
    [
      id,
      item.title,
      item.kind,
      priority,
      item.amount ?? 0,
      item.payee_name ?? null,
      item.category_id ?? null,
      item.target_date ?? null,
      item.frequency ?? null,
      item.notes ?? null,
      now,
    ],
  );

  return id;
}

type UpdatablePriorityFields = Partial<
  Pick<
    PriorityItemEntity,
    | 'title'
    | 'kind'
    | 'priority'
    | 'amount'
    | 'payee_name'
    | 'category_id'
    | 'target_date'
    | 'frequency'
    | 'notes'
  >
>;

export async function updatePriorityItem({
  id,
  fields,
}: {
  id: PriorityItemEntity['id'];
  fields: UpdatablePriorityFields;
}) {
  ensureTable();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.title !== undefined) {
    updates.push('title = ?');
    values.push(fields.title);
  }
  if (fields.kind !== undefined) {
    updates.push('kind = ?');
    values.push(fields.kind);
  }
  if (fields.priority !== undefined) {
    updates.push('priority = ?');
    values.push(fields.priority);
  }
  if (fields.amount !== undefined) {
    updates.push('amount = ?');
    values.push(fields.amount);
  }
  if (fields.payee_name !== undefined) {
    updates.push('payee_name = ?');
    values.push(fields.payee_name);
  }
  if (fields.category_id !== undefined) {
    updates.push('category_id = ?');
    values.push(fields.category_id);
  }
  if (fields.target_date !== undefined) {
    updates.push('target_date = ?');
    values.push(fields.target_date);
  }
  if (fields.frequency !== undefined) {
    updates.push('frequency = ?');
    values.push(fields.frequency);
  }
  if (fields.notes !== undefined) {
    updates.push('notes = ?');
    values.push(fields.notes);
  }

  if (updates.length === 0) return;

  values.push(id);
  db.runQuery(
    `UPDATE priority_items SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function deletePriorityItem({
  id,
}: {
  id: PriorityItemEntity['id'];
}) {
  ensureTable();
  db.runQuery('UPDATE priority_items SET tombstone = 1 WHERE id = ?', [id]);
}

export async function reorderPriorityItems({
  order,
}: {
  order: Array<{ id: PriorityItemEntity['id']; priority: number }>;
}) {
  ensureTable();
  for (const entry of order) {
    db.runQuery('UPDATE priority_items SET priority = ? WHERE id = ?', [
      entry.priority,
      entry.id,
    ]);
  }
}

/**
 * Approve path used for `kind = 'todo'` items that don't need a schedule.
 * PR 2 will introduce an atomic `priority-item/approve-with-schedule` for
 * purchase / recurring kinds.
 */
export async function approvePriorityItem({
  id,
  scheduleId,
}: {
  id: PriorityItemEntity['id'];
  scheduleId?: string | null;
}) {
  ensureTable();
  const now = new Date().toISOString();
  db.runQuery(
    `UPDATE priority_items
        SET status = 'approved', approved_at = ?, schedule_id = ?
      WHERE id = ?`,
    [now, scheduleId ?? null, id],
  );
}

export async function dismissPriorityItem({
  id,
}: {
  id: PriorityItemEntity['id'];
}) {
  ensureTable();
  db.runQuery(
    `UPDATE priority_items SET status = 'dismissed' WHERE id = ?`,
    [id],
  );
}

/**
 * Move a dismissed or approved item back to pending. Clears the approved_at
 * timestamp and any linked schedule_id so the item is once again actionable.
 */
export async function reopenPriorityItem({
  id,
}: {
  id: PriorityItemEntity['id'];
}) {
  ensureTable();
  db.runQuery(
    `UPDATE priority_items
        SET status = 'pending', approved_at = NULL, schedule_id = NULL
      WHERE id = ?`,
    [id],
  );
}

/**
 * One-click path: creates a schedule directly from the priority item's data
 * (no modal), then atomically links the new schedule id back to the item.
 * Picks the first active on-budget account if none is provided.
 */
export async function quickSchedulePriorityItem({
  id,
  accountId,
}: {
  id: PriorityItemEntity['id'];
  accountId?: string;
}): Promise<{ scheduleId: string }> {
  ensureTable();

  const item = await getPriorityItem({ id });
  if (!item) {
    throw new Error('Priority item not found');
  }
  if (!item.amount) {
    throw new Error(
      'Cannot schedule a priority item without an amount — set an amount first.',
    );
  }

  // Resolve account
  let scheduleAccount = accountId;
  if (!scheduleAccount) {
    const rows = db.runQuery<{ id: string }>(
      `SELECT id FROM accounts
         WHERE tombstone = 0 AND closed = 0
         ORDER BY offbudget ASC, sort_order, name
         LIMIT 1`,
      [],
      true,
    );
    scheduleAccount = rows[0]?.id;
  }
  if (!scheduleAccount) {
    throw new Error(
      'No active account found. Create or reopen an account first.',
    );
  }

  // Resolve start date (target_date or today)
  const startDate = item.target_date || monthUtils.currentDay();

  // Build the date condition value: recurring items use a RecurConfig; one-time
  // items use a plain date string.
  const isRecurring =
    item.kind === 'recurring' && item.frequency && item.frequency !== 'once';

  let dateValue: unknown;
  if (isRecurring) {
    const recurFrequency =
      item.frequency === 'biweekly' ? 'weekly' : item.frequency;
    const interval = item.frequency === 'biweekly' ? 2 : 1;
    dateValue = {
      start: startDate,
      frequency: recurFrequency,
      interval,
      patterns: [],
      skipWeekend: false,
      weekendSolveMode: 'after',
      endMode: 'never',
      endOccurrences: 1,
      endDate: startDate,
    };
  } else {
    dateValue = startDate;
  }

  const conditions = [
    { op: 'is', field: 'account', value: scheduleAccount },
    { op: 'isapprox', field: 'date', value: dateValue },
    { op: 'isapprox', field: 'amount', value: item.amount },
  ];

  const actions: Array<{ op: string; field: string; value: string }> = [];
  if (item.category_id) {
    actions.push({
      op: 'set',
      field: 'category',
      value: item.category_id,
    });
  }

  // Pick a unique name — createSchedule throws on name collisions.
  const baseName = item.title;
  let scheduleName = baseName;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await scheduleNameExists(scheduleName)) {
    suffix += 1;
    scheduleName = `${baseName} (${suffix})`;
  }

  const scheduleId = await createSchedule({
    schedule: {
      name: scheduleName,
      posts_transaction: false,
    },
    conditions,
    actions,
  });

  // Once the schedule exists, the item's job is done from a priority/
  // planning perspective — it now lives under /schedules. Tombstone it so
  // it disappears from the priority list. We still stamp the schedule_id
  // and approved_at first so any downstream query that needs to correlate
  // tombstoned items to schedules has the link.
  await approvePriorityItem({ id, scheduleId });
  await deletePriorityItem({ id });

  return { scheduleId };
}

async function scheduleNameExists(name: string): Promise<boolean> {
  const rows = db.runQuery<{ id: string }>(
    'SELECT id FROM schedules WHERE tombstone = 0 AND name = ? LIMIT 1',
    [name],
    true,
  );
  return rows.length > 0;
}

export async function listPriorityItems({
  status,
}: {
  status?: PriorityItemStatus;
} = {}): Promise<PriorityItemEntity[]> {
  ensureTable();

  const where = ['tombstone = 0'];
  const params: (string | number)[] = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }

  const rows = db.runQuery<PriorityItemEntity>(
    `SELECT * FROM priority_items
      WHERE ${where.join(' AND ')}
      ORDER BY priority ASC, created_at ASC`,
    params,
    true,
  );

  return rows.map(normalizeRow);
}

export async function getPriorityItem({
  id,
}: {
  id: PriorityItemEntity['id'];
}): Promise<PriorityItemEntity | null> {
  ensureTable();
  const rows = db.runQuery<PriorityItemEntity>(
    'SELECT * FROM priority_items WHERE id = ? AND tombstone = 0',
    [id],
    true,
  );
  if (rows.length === 0) return null;
  return normalizeRow(rows[0]);
}

export type PriorityListHandlers = {
  'priority-item/create': typeof createPriorityItem;
  'priority-item/update': typeof updatePriorityItem;
  'priority-item/delete': typeof deletePriorityItem;
  'priority-item/reorder': typeof reorderPriorityItems;
  'priority-item/approve': typeof approvePriorityItem;
  'priority-item/dismiss': typeof dismissPriorityItem;
  'priority-item/reopen': typeof reopenPriorityItem;
  'priority-item/quick-schedule': typeof quickSchedulePriorityItem;
  'priority-item/list': typeof listPriorityItems;
  'priority-item/get': typeof getPriorityItem;
};

export const app = createApp<PriorityListHandlers>();

app.method('priority-item/create', mutator(createPriorityItem));
app.method('priority-item/update', mutator(updatePriorityItem));
app.method('priority-item/delete', mutator(deletePriorityItem));
app.method('priority-item/reorder', mutator(reorderPriorityItems));
app.method('priority-item/approve', mutator(approvePriorityItem));
app.method('priority-item/dismiss', mutator(dismissPriorityItem));
app.method('priority-item/reopen', mutator(reopenPriorityItem));
app.method(
  'priority-item/quick-schedule',
  mutator(quickSchedulePriorityItem),
);
app.method('priority-item/list', listPriorityItems);
app.method('priority-item/get', getPriorityItem);
