import { getAccountDb } from '../src/account-db';

export const up = async function () {
  const accountDb = getAccountDb();

  accountDb.transaction(() => {
    // Add role column to user_access (default EDITOR for backward compatibility)
    accountDb.exec(`
      ALTER TABLE user_access ADD COLUMN role TEXT NOT NULL DEFAULT 'EDITOR';
    `);

    // Create file_roles lookup table for role hierarchy
    accountDb.exec(`
      CREATE TABLE file_roles (
        id TEXT PRIMARY KEY,
        level INTEGER NOT NULL UNIQUE
      );

      INSERT INTO file_roles (id, level) VALUES
        ('VIEWER', 10),
        ('EDITOR', 20),
        ('ADMIN', 30),
        ('OWNER', 40);
    `);
  });
};

export const down = async function () {
  const accountDb = getAccountDb();

  accountDb.transaction(() => {
    // Drop file_roles table
    accountDb.exec('DROP TABLE IF EXISTS file_roles;');

    // Remove role column from user_access by recreating the table
    accountDb.exec(`
      CREATE TABLE user_access_backup (
        user_id TEXT,
        file_id TEXT,
        PRIMARY KEY (user_id, file_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (file_id) REFERENCES files(id)
      );

      INSERT INTO user_access_backup (user_id, file_id)
      SELECT user_id, file_id FROM user_access;

      DROP TABLE user_access;

      ALTER TABLE user_access_backup RENAME TO user_access;
    `);
  });
};
