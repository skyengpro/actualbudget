import { v4 as uuidv4 } from 'uuid';

import * as monthUtils from '../../shared/months';
import type {
  ReimbursementEntity,
  ReimbursementStatus,
} from '../../types/models';
import { addTransactions } from '../accounts/sync';
import { createApp } from '../app';
import * as db from '../db';
import { mutator } from '../mutators';

const VALID_TRANSITIONS: Record<ReimbursementStatus, ReimbursementStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  rejected: [],
  paid: [],
};

// Ensure the reimbursements table exists
let tableInitialized = false;
function ensureTable() {
  if (tableInitialized) return;

  db.execQuery(`
    CREATE TABLE IF NOT EXISTS reimbursements
      (id TEXT PRIMARY KEY,
       transaction_id TEXT,
       payment_transaction_id TEXT,
       employee_name TEXT NOT NULL,
       amount INTEGER NOT NULL,
       status TEXT NOT NULL DEFAULT 'pending',
       date_submitted TEXT NOT NULL,
       date_approved TEXT,
       date_paid TEXT,
       description TEXT,
       tombstone INTEGER DEFAULT 0)
  `);
  tableInitialized = true;
}

export async function createReimbursement({
  reimbursement,
}: {
  reimbursement: Omit<ReimbursementEntity, 'id' | 'tombstone' | 'status'> & {
    id?: string;
    status?: ReimbursementStatus;
  };
}): Promise<ReimbursementEntity['id']> {
  ensureTable();

  const id = reimbursement.id || uuidv4();

  if (!reimbursement.employee_name) {
    throw new Error('Employee name is required');
  }

  if (reimbursement.amount == null) {
    throw new Error('Amount is required');
  }

  if (!reimbursement.date_submitted) {
    throw new Error('Date submitted is required');
  }

  // Use direct SQL insert (bypasses sync system)
  db.runQuery(
    `INSERT INTO reimbursements (id, employee_name, amount, status, date_submitted, description, transaction_id, payment_transaction_id, tombstone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      reimbursement.employee_name,
      reimbursement.amount,
      reimbursement.status || 'pending',
      reimbursement.date_submitted,
      reimbursement.description || null,
      reimbursement.transaction_id || null,
      reimbursement.payment_transaction_id || null,
    ],
  );

  return id;
}

export async function updateReimbursement({
  id,
  fields,
}: {
  id: ReimbursementEntity['id'];
  fields: Partial<Omit<ReimbursementEntity, 'id' | 'tombstone' | 'status'>>;
}) {
  ensureTable();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.employee_name !== undefined) {
    updates.push('employee_name = ?');
    values.push(fields.employee_name);
  }
  if (fields.amount !== undefined) {
    updates.push('amount = ?');
    values.push(fields.amount);
  }
  if (fields.date_submitted !== undefined) {
    updates.push('date_submitted = ?');
    values.push(fields.date_submitted);
  }
  if (fields.description !== undefined) {
    updates.push('description = ?');
    values.push(fields.description);
  }
  if (fields.transaction_id !== undefined) {
    updates.push('transaction_id = ?');
    values.push(fields.transaction_id);
  }
  if (fields.payment_transaction_id !== undefined) {
    updates.push('payment_transaction_id = ?');
    values.push(fields.payment_transaction_id);
  }

  if (updates.length > 0) {
    values.push(id);
    db.runQuery(
      `UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
  }
}

export async function updateReimbursementStatus({
  id,
  status,
  accountId,
  categoryId,
}: {
  id: ReimbursementEntity['id'];
  status: ReimbursementStatus;
  accountId?: string;
  categoryId?: string;
}) {
  ensureTable();

  const rows = db.runQuery<ReimbursementEntity>(
    'SELECT * FROM reimbursements WHERE id = ?',
    [id],
    true,
  );

  const reimbursement = rows[0];
  if (!reimbursement) {
    throw new Error('Reimbursement not found');
  }

  const currentStatus = reimbursement.status as ReimbursementStatus;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];

  if (!allowedTransitions.includes(status)) {
    throw new Error(
      `Invalid status transition from '${currentStatus}' to '${status}'`,
    );
  }

  const updates: string[] = ['status = ?'];
  const values: (string | null)[] = [status];

  if (status === 'approved') {
    updates.push('date_approved = ?');
    values.push(new Date().toISOString().split('T')[0]);
  } else if (status === 'paid') {
    if (!accountId) {
      throw new Error('Account is required to mark reimbursement as paid');
    }

    // Create a transaction for the payment (negative amount = money going out)
    const transactionIds = await addTransactions(accountId, [
      {
        date: monthUtils.currentDay(),
        amount: -reimbursement.amount, // Negative because money is going out
        payee_name: reimbursement.employee_name,
        category: categoryId || null,
        notes: `Reimbursement: ${reimbursement.description || 'Employee reimbursement'}`,
        cleared: true,
      },
    ]);

    updates.push('date_paid = ?');
    values.push(new Date().toISOString().split('T')[0]);
    updates.push('payment_transaction_id = ?');
    values.push(transactionIds[0] || null);
  }

  values.push(id);
  db.runQuery(
    `UPDATE reimbursements SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

export async function deleteReimbursement({
  id,
}: {
  id: ReimbursementEntity['id'];
}) {
  ensureTable();
  db.runQuery('UPDATE reimbursements SET tombstone = 1 WHERE id = ?', [id]);
}

export async function listReimbursements(): Promise<ReimbursementEntity[]> {
  ensureTable();

  const rows = db.runQuery<ReimbursementEntity>(
    'SELECT * FROM reimbursements WHERE tombstone = 0 ORDER BY date_submitted DESC',
    [],
    true,
  );

  return rows.map(row => ({
    ...row,
    tombstone: Boolean(row.tombstone),
  }));
}

export async function getReimbursement({
  id,
}: {
  id: ReimbursementEntity['id'];
}): Promise<ReimbursementEntity | null> {
  ensureTable();

  const rows = db.runQuery<ReimbursementEntity>(
    'SELECT * FROM reimbursements WHERE id = ? AND tombstone = 0',
    [id],
    true,
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    tombstone: Boolean(rows[0].tombstone),
  };
}

/**
 * Cleanup old paid reimbursements
 * Archives (soft deletes) paid reimbursements older than the specified months
 */
export async function cleanupOldReimbursements({
  monthsOld = 12,
}: {
  monthsOld?: number;
}): Promise<{ deleted: number; cutoffDate: string }> {
  ensureTable();

  // Calculate cutoff date (12 months ago by default)
  const cutoffDate = monthUtils.subMonths(monthUtils.currentMonth(), monthsOld);
  const cutoffDateStr = `${cutoffDate}-01`; // First day of the cutoff month

  // Find old paid reimbursements
  const oldReimbursements = db.runQuery<{ id: string; date_paid: string }>(
    `SELECT id, date_paid FROM reimbursements
     WHERE status = 'paid'
     AND tombstone = 0
     AND date_paid IS NOT NULL
     AND date_paid < ?`,
    [cutoffDateStr],
    true,
  );

  // Soft delete (tombstone) them
  if (oldReimbursements.length > 0) {
    const ids = oldReimbursements.map(r => r.id);
    db.runQuery(
      `UPDATE reimbursements SET tombstone = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
  }

  console.log(`[Reimbursement Cleanup] Deleted ${oldReimbursements.length} paid reimbursements older than ${cutoffDateStr}`);

  return {
    deleted: oldReimbursements.length,
    cutoffDate: cutoffDateStr,
  };
}

/**
 * Get cleanup statistics - how many items would be cleaned up
 */
export async function getCleanupStats({
  monthsOld = 12,
}: {
  monthsOld?: number;
}): Promise<{ count: number; cutoffDate: string }> {
  ensureTable();

  const cutoffDate = monthUtils.subMonths(monthUtils.currentMonth(), monthsOld);
  const cutoffDateStr = `${cutoffDate}-01`;

  const result = db.runQuery<{ count: number }>(
    `SELECT COUNT(*) as count FROM reimbursements
     WHERE status = 'paid'
     AND tombstone = 0
     AND date_paid IS NOT NULL
     AND date_paid < ?`,
    [cutoffDateStr],
    true,
  );

  return {
    count: result[0]?.count || 0,
    cutoffDate: cutoffDateStr,
  };
}

export type ReimbursementsHandlers = {
  'reimbursement/create': typeof createReimbursement;
  'reimbursement/update': typeof updateReimbursement;
  'reimbursement/update-status': typeof updateReimbursementStatus;
  'reimbursement/delete': typeof deleteReimbursement;
  'reimbursement/list': typeof listReimbursements;
  'reimbursement/get': typeof getReimbursement;
  'reimbursement/cleanup': typeof cleanupOldReimbursements;
  'reimbursement/cleanup-stats': typeof getCleanupStats;
};

export const app = createApp<ReimbursementsHandlers>();

app.method('reimbursement/create', mutator(createReimbursement));
app.method('reimbursement/update', mutator(updateReimbursement));
app.method('reimbursement/update-status', mutator(updateReimbursementStatus));
app.method('reimbursement/delete', mutator(deleteReimbursement));
app.method('reimbursement/list', listReimbursements);
app.method('reimbursement/get', getReimbursement);
app.method('reimbursement/cleanup', mutator(cleanupOldReimbursements));
app.method('reimbursement/cleanup-stats', getCleanupStats);
