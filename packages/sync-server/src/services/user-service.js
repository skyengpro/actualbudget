import { getAccountDb } from '../account-db';

export function getUserByUsername(userName) {
  if (!userName || typeof userName !== 'string') {
    return null;
  }
  const { id } =
    getAccountDb().first('SELECT id FROM users WHERE user_name = ?', [
      userName,
    ]) || {};
  return id || null;
}

export function getUserById(userId) {
  if (!userId) {
    return null;
  }
  const { id } =
    getAccountDb().first('SELECT * FROM users WHERE id = ?', [userId]) || {};
  return id || null;
}

export function getFileById(fileId) {
  if (!fileId) {
    return null;
  }
  const { id } =
    getAccountDb().first('SELECT * FROM files WHERE files.id = ?', [fileId]) ||
    {};
  return id || null;
}

export function validateRole(roleId) {
  const possibleRoles = ['BASIC', 'ADMIN'];
  return possibleRoles.some(a => a === roleId);
}

export function getOwnerCount() {
  const { ownerCount } = getAccountDb().first(
    `SELECT count(*) as ownerCount FROM users WHERE users.user_name <> '' and users.owner = 1`,
  ) || { ownerCount: 0 };
  return ownerCount;
}

export function getOwnerId() {
  const { id } =
    getAccountDb().first(
      `SELECT users.id FROM users WHERE users.user_name <> '' and users.owner = 1`,
    ) || {};
  return id;
}

export function getFileOwnerId(fileId) {
  const { owner } =
    getAccountDb().first(`SELECT files.owner FROM files WHERE files.id = ?`, [
      fileId,
    ]) || {};
  return owner;
}

export function getAllUsers() {
  return getAccountDb().all(
    `SELECT users.id, user_name as userName, display_name as displayName, enabled, ifnull(owner,0) as owner, role
     FROM users
     WHERE users.user_name <> ''`,
  );
}

export function insertUser(userId, userName, displayName, enabled, role) {
  getAccountDb().mutate(
    'INSERT INTO users (id, user_name, display_name, enabled, owner, role) VALUES (?, ?, ?, ?, 0, ?)',
    [userId, userName, displayName, enabled, role],
  );
}

export function updateUser(userId, userName, displayName, enabled) {
  if (!userId || !userName) {
    throw new Error('Invalid user parameters');
  }
  try {
    getAccountDb().mutate(
      'UPDATE users SET user_name = ?, display_name = ?, enabled = ? WHERE id = ?',
      [userName, displayName, enabled, userId],
    );
  } catch (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
}

export function updateUserWithRole(
  userId,
  userName,
  displayName,
  enabled,
  roleId,
) {
  getAccountDb().transaction(() => {
    getAccountDb().mutate(
      'UPDATE users SET user_name = ?, display_name = ?, enabled = ?, role = ? WHERE id = ?',
      [userName, displayName, enabled, roleId, userId],
    );
  });
}

export function deleteUser(userId) {
  return getAccountDb().mutate('DELETE FROM users WHERE id = ? and owner = 0', [
    userId,
  ]).changes;
}
export function deleteUserAccess(userId) {
  try {
    return getAccountDb().mutate('DELETE FROM user_access WHERE user_id = ?', [
      userId,
    ]).changes;
  } catch (error) {
    throw new Error(`Failed to delete user access: ${error.message}`);
  }
}

export function transferAllFilesFromUser(ownerId, oldUserId) {
  if (!ownerId || !oldUserId) {
    throw new Error('Invalid user IDs');
  }
  try {
    getAccountDb().transaction(() => {
      const ownerExists = getUserById(ownerId);
      if (!ownerExists) {
        throw new Error('New owner not found');
      }
      getAccountDb().mutate('UPDATE files set owner = ? WHERE owner = ?', [
        ownerId,
        oldUserId,
      ]);
    });
  } catch (error) {
    throw new Error(`Failed to transfer files: ${error.message}`);
  }
}

export function updateFileOwner(ownerId, fileId) {
  if (!ownerId || !fileId) {
    throw new Error('Invalid parameters');
  }
  try {
    const result = getAccountDb().mutate(
      'UPDATE files set owner = ? WHERE id = ?',
      [ownerId, fileId],
    );
    if (result.changes === 0) {
      throw new Error('File not found');
    }
  } catch (error) {
    throw new Error(`Failed to update file owner: ${error.message}`);
  }
}

export function getUserAccess(fileId, userId, isAdmin) {
  return getAccountDb().all(
    `SELECT users.id as userId, user_name as userName, files.owner, display_name as displayName
     FROM users
     JOIN user_access ON user_access.user_id = users.id
     JOIN files ON files.id = user_access.file_id
     WHERE files.id = ? and (files.owner = ? OR 1 = ?)`,
    [fileId, userId, isAdmin ? 1 : 0],
  );
}

export function countUserAccess(fileId, userId) {
  const { accessCount } =
    getAccountDb().first(
      `SELECT COUNT(*) as accessCount
       FROM files
       WHERE files.id = ? AND (files.owner = ? OR EXISTS (
         SELECT 1 FROM user_access
         WHERE user_access.user_id = ? AND user_access.file_id = ?)
       )`,
      [fileId, userId, userId, fileId],
    ) || {};

  return accessCount || 0;
}

export function checkFilePermission(fileId, userId) {
  return (
    getAccountDb().first(
      `SELECT 1 as granted
       FROM files
       WHERE files.id = ? and (files.owner = ?)`,
      [fileId, userId],
    ) || { granted: 0 }
  );
}

export function addUserAccess(userId, fileId, role = 'EDITOR') {
  if (!userId || !fileId) {
    throw new Error('Invalid parameters');
  }
  try {
    const userExists = getUserById(userId);
    const fileExists = getFileById(fileId);
    if (!userExists || !fileExists) {
      throw new Error('User or file not found');
    }
    getAccountDb().mutate(
      'INSERT INTO user_access (user_id, file_id, role) VALUES (?, ?, ?)',
      [userId, fileId, role],
    );
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      throw new Error('Access already exists');
    }
    throw new Error(`Failed to add user access: ${error.message}`);
  }
}

export function updateUserFileRole(userId, fileId, role) {
  if (!userId || !fileId || !role) {
    throw new Error('Invalid parameters');
  }
  const validRoles = ['VIEWER', 'EDITOR', 'ADMIN'];
  if (!validRoles.includes(role)) {
    throw new Error('Invalid role');
  }
  try {
    const result = getAccountDb().mutate(
      'UPDATE user_access SET role = ? WHERE user_id = ? AND file_id = ?',
      [role, userId, fileId],
    );
    if (result.changes === 0) {
      throw new Error('Access not found');
    }
  } catch (error) {
    throw new Error(`Failed to update user file role: ${error.message}`);
  }
}

export function deleteUserAccessByFileId(userIds, fileId) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('The provided userIds must be a non-empty array.');
  }

  const CHUNK_SIZE = 999;
  let totalChanges = 0;

  try {
    getAccountDb().transaction(() => {
      for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        const chunk = userIds.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');

        const sql = `DELETE FROM user_access WHERE user_id IN (${placeholders}) AND file_id = ?`;

        const result = getAccountDb().mutate(sql, [...chunk, fileId]);
        totalChanges += result.changes;
      }
    });
  } catch (error) {
    throw new Error(`Failed to delete user access: ${error.message}`);
  }

  return totalChanges;
}

export function getAllUserAccess(fileId) {
  //This can't be used here until we can create user invite links:
  //const isLoginMode = config.get('userCreationMode') === 'login';
  const isLoginMode = false;
  const joinType = isLoginMode ? 'JOIN' : 'LEFT JOIN';

  return getAccountDb().all(
    `
      SELECT
        users.id as userId,
        user_name     as userName,
        display_name  as displayName,
        CASE WHEN user_access.file_id IS NULL THEN 0 ELSE 1 END as haveAccess,
        CASE WHEN files.id IS NULL THEN 0 ELSE 1 END as owner,
        COALESCE(user_access.role, CASE WHEN files.id IS NOT NULL THEN 'OWNER' ELSE NULL END) as role
      FROM users
      ${joinType} user_access ON user_access.file_id = ? AND user_access.user_id = users.id
      ${joinType} files       ON files.id = ? AND files.owner = users.id
      WHERE users.enabled = 1
        AND users.user_name <> ''
    `,
    [fileId, fileId],
  );
}

export function getUserFileRole(userId, fileId) {
  if (!userId || !fileId) {
    return null;
  }
  const accountDb = getAccountDb();

  // Check if user is the file owner
  const file = accountDb.first('SELECT owner FROM files WHERE id = ?', [
    fileId,
  ]);
  if (file?.owner === userId) {
    return 'OWNER';
  }

  // Check user_access table for explicit role
  const access = accountDb.first(
    'SELECT role FROM user_access WHERE user_id = ? AND file_id = ?',
    [userId, fileId],
  );

  return access?.role || null;
}

export function getOpenIDConfig() {
  return (
    getAccountDb().first(`SELECT * FROM auth WHERE method = ?`, ['openid']) ||
    null
  );
}
