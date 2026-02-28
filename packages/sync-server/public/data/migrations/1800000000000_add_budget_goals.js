export default async function runMigration(db) {
  db.transaction(() => {
    db.execQuery(`
      CREATE TABLE IF NOT EXISTS budget_goals
        (id TEXT PRIMARY KEY,
         category_id TEXT NOT NULL,
         goal_type TEXT NOT NULL,
         target_amount INTEGER NOT NULL,
         target_date TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         tombstone INTEGER DEFAULT 0,
         FOREIGN KEY (category_id) REFERENCES categories(id));
    `);

    db.execQuery(`
      CREATE INDEX IF NOT EXISTS budget_goals_category_id ON budget_goals(category_id);
    `);
  });
}
