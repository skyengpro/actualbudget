export default function (db) {
  // Add currency field to accounts table
  db.execQuery(`
    ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'USD'
  `);

  // Create exchange_rates table for currency conversion
  db.execQuery(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(from_currency, to_currency)
    )
  `);

  // Insert some default exchange rates (can be updated by user)
  const defaultRates = [
    ['USD', 'EUR', 0.92],
    ['EUR', 'USD', 1.09],
    ['USD', 'GBP', 0.79],
    ['GBP', 'USD', 1.27],
    ['USD', 'XAF', 600],
    ['XAF', 'USD', 0.00167],
    ['EUR', 'XAF', 655.96],
    ['XAF', 'EUR', 0.00152],
  ];

  const now = new Date().toISOString();
  for (const [from, to, rate] of defaultRates) {
    db.execQuery(
      `INSERT OR IGNORE INTO exchange_rates (id, from_currency, to_currency, rate, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`${from}_${to}`, from, to, rate, now],
    );
  }
}
