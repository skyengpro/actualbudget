BEGIN TRANSACTION;

CREATE TABLE transaction_templates
  (id TEXT PRIMARY KEY,
   name TEXT NOT NULL,
   account TEXT,
   payee TEXT,
   category TEXT,
   amount INTEGER,
   notes TEXT,
   active INTEGER DEFAULT 1,
   tombstone INTEGER DEFAULT 0);

COMMIT;
