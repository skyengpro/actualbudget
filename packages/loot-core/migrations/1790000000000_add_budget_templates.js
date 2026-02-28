export default async function runMigration(db) {
  db.transaction(() => {
    db.execQuery(`
      CREATE TABLE IF NOT EXISTS budget_templates
        (id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         description TEXT,
         data TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         tombstone INTEGER DEFAULT 0);
    `);
  });
}
