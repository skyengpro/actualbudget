export default async function runMigration(db) {
  db.transaction(() => {
    // Main scenarios table
    db.execQuery(`
      CREATE TABLE IF NOT EXISTS budget_scenarios
        (id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         description TEXT,
         base_month TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         tombstone INTEGER DEFAULT 0);
    `);

    // Scenario budget data (stores modified budget values)
    db.execQuery(`
      CREATE TABLE IF NOT EXISTS budget_scenario_data
        (id TEXT PRIMARY KEY,
         scenario_id TEXT NOT NULL,
         category_id TEXT NOT NULL,
         month TEXT NOT NULL,
         amount INTEGER NOT NULL,
         FOREIGN KEY (scenario_id) REFERENCES budget_scenarios(id),
         UNIQUE(scenario_id, category_id, month));
    `);

    db.execQuery(`
      CREATE INDEX IF NOT EXISTS budget_scenario_data_scenario_id ON budget_scenario_data(scenario_id);
    `);
  });
}
