export default async function runMigration(db) {
  db.transaction(() => {
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
         tombstone INTEGER NOT NULL DEFAULT 0);
    `);

    db.execQuery(`
      CREATE INDEX IF NOT EXISTS priority_items_status_priority
        ON priority_items(status, priority);
    `);
  });
}
