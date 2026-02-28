export default async function runMigration(db) {
  db.transaction(() => {
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
         tombstone INTEGER DEFAULT 0);
    `);
  });
}
