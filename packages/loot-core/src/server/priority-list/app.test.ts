// @ts-strict-ignore
import * as db from '../db';

import {
  approvePriorityItem,
  createPriorityItem,
  deletePriorityItem,
  dismissPriorityItem,
  getPriorityItem,
  listPriorityItems,
  quickSchedulePriorityItem,
  reopenPriorityItem,
  reorderPriorityItems,
  updatePriorityItem,
} from './app';

beforeEach(() => {
  return global.emptyDatabase()();
});

describe('Priority List', () => {
  it('creates an item with defaults and returns it from list', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'New laptop',
        kind: 'purchase',
        amount: -150000,
        payee_name: 'Apple Store',
        category_id: null,
        target_date: '2026-06-01',
        frequency: 'once',
        notes: null,
      },
    });

    expect(id).toBeTruthy();

    const items = await listPriorityItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id,
      title: 'New laptop',
      kind: 'purchase',
      status: 'pending',
      amount: -150000,
      payee_name: 'Apple Store',
      target_date: '2026-06-01',
      frequency: 'once',
      schedule_id: null,
      approved_at: null,
      tombstone: 0,
    });
    expect(items[0].priority).toBe(0);
    expect(items[0].created_at).toBeTruthy();
  });

  it('auto-increments priority across sequential creates', async () => {
    await createPriorityItem({
      item: {
        title: 'First',
        kind: 'purchase',
        amount: -1000,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    await createPriorityItem({
      item: {
        title: 'Second',
        kind: 'purchase',
        amount: -2000,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    await createPriorityItem({
      item: {
        title: 'Third',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    const items = await listPriorityItems();
    expect(items.map(i => i.title)).toEqual(['First', 'Second', 'Third']);
    expect(items.map(i => i.priority)).toEqual([0, 1, 2]);
  });

  it('updates editable fields and ignores status / schedule_id', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Gym subscription',
        kind: 'recurring',
        amount: -3000,
        payee_name: 'Gym',
        category_id: null,
        target_date: '2026-05-01',
        frequency: 'monthly',
        notes: null,
      },
    });

    await updatePriorityItem({
      id,
      fields: {
        title: 'Premium gym subscription',
        amount: -4500,
        notes: 'Includes classes',
      },
    });

    const item = await getPriorityItem({ id });
    expect(item).toMatchObject({
      title: 'Premium gym subscription',
      amount: -4500,
      notes: 'Includes classes',
      status: 'pending',
    });
  });

  it('reorder rewrites the priority column', async () => {
    const a = await createPriorityItem({
      item: {
        title: 'A',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    const b = await createPriorityItem({
      item: {
        title: 'B',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    const c = await createPriorityItem({
      item: {
        title: 'C',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    await reorderPriorityItems({
      order: [
        { id: c, priority: 0 },
        { id: a, priority: 1 },
        { id: b, priority: 2 },
      ],
    });

    const items = await listPriorityItems();
    expect(items.map(i => i.title)).toEqual(['C', 'A', 'B']);
  });

  it('approve flips status, records approved_at, and stores schedule_id', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Cancel Netflix',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    await approvePriorityItem({ id });
    const approvedTodo = await getPriorityItem({ id });
    expect(approvedTodo.status).toBe('approved');
    expect(approvedTodo.approved_at).toBeTruthy();
    expect(approvedTodo.schedule_id).toBeNull();

    const purchaseId = await createPriorityItem({
      item: {
        title: 'Monthly donation',
        kind: 'recurring',
        amount: -5000,
        payee_name: 'Charity',
        category_id: null,
        target_date: '2026-05-01',
        frequency: 'monthly',
        notes: null,
      },
    });
    await approvePriorityItem({ id: purchaseId, scheduleId: 'sched-1' });
    const approvedPurchase = await getPriorityItem({ id: purchaseId });
    expect(approvedPurchase.status).toBe('approved');
    expect(approvedPurchase.schedule_id).toBe('sched-1');
  });

  it('reopen moves dismissed or approved item back to pending and clears schedule link', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Maybe subscribe',
        kind: 'recurring',
        amount: -2000,
        payee_name: null,
        category_id: null,
        target_date: '2026-05-01',
        frequency: 'monthly',
        notes: null,
      },
    });

    await approvePriorityItem({ id, scheduleId: 'sched-42' });
    let item = await getPriorityItem({ id });
    expect(item.status).toBe('approved');
    expect(item.schedule_id).toBe('sched-42');

    await reopenPriorityItem({ id });
    item = await getPriorityItem({ id });
    expect(item.status).toBe('pending');
    expect(item.schedule_id).toBeNull();
    expect(item.approved_at).toBeNull();

    await dismissPriorityItem({ id });
    await reopenPriorityItem({ id });
    item = await getPriorityItem({ id });
    expect(item.status).toBe('pending');
  });

  it('dismiss sets status and keeps item in the table', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Maybe buy',
        kind: 'purchase',
        amount: -1000,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    await dismissPriorityItem({ id });
    const item = await getPriorityItem({ id });
    expect(item.status).toBe('dismissed');
    expect(item.tombstone).toBe(0);
  });

  it('delete tombstones the item and removes it from queries', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Soon to be gone',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    await deletePriorityItem({ id });
    expect(await getPriorityItem({ id })).toBeNull();
    expect(await listPriorityItems()).toHaveLength(0);
  });

  it('list filters by status', async () => {
    const a = await createPriorityItem({
      item: {
        title: 'Pending 1',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    const b = await createPriorityItem({
      item: {
        title: 'Pending 2',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });
    await approvePriorityItem({ id: a });
    await dismissPriorityItem({ id: b });

    await createPriorityItem({
      item: {
        title: 'Pending 3',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    expect(
      (await listPriorityItems({ status: 'pending' })).map(i => i.title),
    ).toEqual(['Pending 3']);
    expect(
      (await listPriorityItems({ status: 'approved' })).map(i => i.title),
    ).toEqual(['Pending 1']);
    expect(
      (await listPriorityItems({ status: 'dismissed' })).map(i => i.title),
    ).toEqual(['Pending 2']);
  });

  it('quick-schedule creates a schedule and removes the item from the list', async () => {
    await db.insertAccount({ id: 'acct-1', name: 'Checking' });

    const id = await createPriorityItem({
      item: {
        title: 'Marketing pipeline',
        kind: 'todo',
        amount: -10000,
        payee_name: 'Yannick',
        category_id: null,
        target_date: '2026-04-28',
        frequency: 'once',
        notes: '#Low',
      },
    });
    await approvePriorityItem({ id });

    const { scheduleId } = await quickSchedulePriorityItem({ id });
    expect(scheduleId).toBeTruthy();

    // Item should no longer appear in any priority-list query.
    expect(await getPriorityItem({ id })).toBeNull();
    expect(await listPriorityItems()).toHaveLength(0);

    // But the schedule row should exist.
    const scheduleRows = db.runQuery(
      'SELECT id, name FROM schedules WHERE id = ?',
      [scheduleId],
      true,
    );
    expect(scheduleRows).toHaveLength(1);
  });

  it('quick-schedule rejects items without an amount', async () => {
    const id = await createPriorityItem({
      item: {
        title: 'Idea only',
        kind: 'todo',
        amount: 0,
        payee_name: null,
        category_id: null,
        target_date: null,
        frequency: null,
        notes: null,
      },
    });

    await expect(quickSchedulePriorityItem({ id })).rejects.toThrow(
      /without an amount/,
    );
  });

  it('rejects creation without title or kind', async () => {
    await expect(
      createPriorityItem({
        item: {
          title: '',
          kind: 'purchase',
          amount: 0,
          payee_name: null,
          category_id: null,
          target_date: null,
          frequency: null,
          notes: null,
        },
      }),
    ).rejects.toThrow(/title is required/);

    await expect(
      createPriorityItem({
        item: {
          title: 'No kind',
          kind: undefined as unknown as 'purchase',
          amount: 0,
          payee_name: null,
          category_id: null,
          target_date: null,
          frequency: null,
          notes: null,
        },
      }),
    ).rejects.toThrow(/kind is required/);
  });
});
