import { v4 as uuidv4 } from 'uuid';

import { getAccountDb } from '../account-db';
import {
  FileRole,
  validateFileRole,
  getUserFileRole,
  hasFileRole,
  FilePermissions,
} from './file-permission-service';

describe('file-permission-service', () => {
  let accountDb;
  let testUserId;
  let testFileId;
  let ownerUserId;

  const createUser = (userId, userName, role = 'BASIC', owner = 0) => {
    accountDb.mutate(
      'INSERT INTO users (id, user_name, display_name, enabled, owner, role) VALUES (?, ?, ?, 1, ?, ?)',
      [userId, userName, `${userName} display`, owner, role],
    );
  };

  const createFile = (fileId, ownerId) => {
    accountDb.mutate(
      'INSERT INTO files (id, group_id, sync_version, name, owner, deleted) VALUES (?, ?, 1, ?, ?, 0)',
      [fileId, `group-${fileId}`, `file-${fileId}`, ownerId],
    );
  };

  const grantFileAccess = (userId, fileId, role = 'EDITOR') => {
    accountDb.mutate(
      'INSERT INTO user_access (user_id, file_id, role) VALUES (?, ?, ?)',
      [userId, fileId, role],
    );
  };

  const cleanup = () => {
    accountDb.mutate('DELETE FROM user_access WHERE file_id = ?', [testFileId]);
    accountDb.mutate('DELETE FROM files WHERE id = ?', [testFileId]);
    accountDb.mutate('DELETE FROM users WHERE id IN (?, ?)', [
      testUserId,
      ownerUserId,
    ]);
  };

  beforeAll(() => {
    accountDb = getAccountDb();
  });

  beforeEach(() => {
    testUserId = uuidv4();
    ownerUserId = uuidv4();
    testFileId = uuidv4();

    // Create owner and test user
    createUser(ownerUserId, 'owner-user', 'BASIC', 0);
    createUser(testUserId, 'test-user', 'BASIC', 0);

    // Create a file owned by ownerUserId
    createFile(testFileId, ownerUserId);
  });

  afterEach(() => {
    cleanup();
  });

  describe('FileRole constants', () => {
    it('should have correct role values', () => {
      expect(FileRole.VIEWER).toBe('VIEWER');
      expect(FileRole.EDITOR).toBe('EDITOR');
      expect(FileRole.ADMIN).toBe('ADMIN');
      expect(FileRole.OWNER).toBe('OWNER');
    });
  });

  describe('validateFileRole', () => {
    it('should return true for valid roles', () => {
      expect(validateFileRole('VIEWER')).toBe(true);
      expect(validateFileRole('EDITOR')).toBe(true);
      expect(validateFileRole('ADMIN')).toBe(true);
      expect(validateFileRole('OWNER')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(validateFileRole('INVALID')).toBe(false);
      expect(validateFileRole('')).toBe(false);
      expect(validateFileRole(null)).toBe(false);
      expect(validateFileRole(undefined)).toBe(false);
    });
  });

  describe('getUserFileRole', () => {
    it('should return OWNER for file owner', () => {
      const role = getUserFileRole(ownerUserId, testFileId);
      expect(role).toBe('OWNER');
    });

    it('should return null for user without access', () => {
      const role = getUserFileRole(testUserId, testFileId);
      expect(role).toBeNull();
    });

    it('should return VIEWER for user with VIEWER access', () => {
      grantFileAccess(testUserId, testFileId, 'VIEWER');
      const role = getUserFileRole(testUserId, testFileId);
      expect(role).toBe('VIEWER');
    });

    it('should return EDITOR for user with EDITOR access', () => {
      grantFileAccess(testUserId, testFileId, 'EDITOR');
      const role = getUserFileRole(testUserId, testFileId);
      expect(role).toBe('EDITOR');
    });

    it('should return ADMIN for user with ADMIN access', () => {
      grantFileAccess(testUserId, testFileId, 'ADMIN');
      const role = getUserFileRole(testUserId, testFileId);
      expect(role).toBe('ADMIN');
    });

    it('should return null for invalid inputs', () => {
      expect(getUserFileRole(null, testFileId)).toBeNull();
      expect(getUserFileRole(testUserId, null)).toBeNull();
      expect(getUserFileRole(null, null)).toBeNull();
    });
  });

  describe('hasFileRole', () => {
    describe('VIEWER role checks', () => {
      it('VIEWER can read (meets VIEWER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(hasFileRole(testUserId, testFileId, 'VIEWER')).toBe(true);
      });

      it('VIEWER cannot write (does not meet EDITOR requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(hasFileRole(testUserId, testFileId, 'EDITOR')).toBe(false);
      });

      it('VIEWER cannot share (does not meet ADMIN requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(hasFileRole(testUserId, testFileId, 'ADMIN')).toBe(false);
      });

      it('VIEWER cannot delete (does not meet OWNER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(hasFileRole(testUserId, testFileId, 'OWNER')).toBe(false);
      });
    });

    describe('EDITOR role checks', () => {
      it('EDITOR can read (meets VIEWER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, 'VIEWER')).toBe(true);
      });

      it('EDITOR can write (meets EDITOR requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, 'EDITOR')).toBe(true);
      });

      it('EDITOR cannot share (does not meet ADMIN requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, 'ADMIN')).toBe(false);
      });

      it('EDITOR cannot delete (does not meet OWNER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, 'OWNER')).toBe(false);
      });
    });

    describe('ADMIN role checks', () => {
      it('ADMIN can read (meets VIEWER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(hasFileRole(testUserId, testFileId, 'VIEWER')).toBe(true);
      });

      it('ADMIN can write (meets EDITOR requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(hasFileRole(testUserId, testFileId, 'EDITOR')).toBe(true);
      });

      it('ADMIN can share (meets ADMIN requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(hasFileRole(testUserId, testFileId, 'ADMIN')).toBe(true);
      });

      it('ADMIN cannot delete (does not meet OWNER requirement)', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(hasFileRole(testUserId, testFileId, 'OWNER')).toBe(false);
      });
    });

    describe('OWNER role checks', () => {
      it('OWNER can do everything', () => {
        expect(hasFileRole(ownerUserId, testFileId, 'VIEWER')).toBe(true);
        expect(hasFileRole(ownerUserId, testFileId, 'EDITOR')).toBe(true);
        expect(hasFileRole(ownerUserId, testFileId, 'ADMIN')).toBe(true);
        expect(hasFileRole(ownerUserId, testFileId, 'OWNER')).toBe(true);
      });
    });

    describe('server admin bypass', () => {
      let adminUserId;

      beforeEach(() => {
        adminUserId = uuidv4();
        // Create a server admin user
        createUser(adminUserId, 'admin-user', 'ADMIN', 0);
      });

      afterEach(() => {
        accountDb.mutate('DELETE FROM users WHERE id = ?', [adminUserId]);
      });

      it('server admin can access files they do not own or have access to', () => {
        // Server admin has no file access but isAdmin() returns true
        expect(hasFileRole(adminUserId, testFileId, 'VIEWER')).toBe(true);
        expect(hasFileRole(adminUserId, testFileId, 'EDITOR')).toBe(true);
        expect(hasFileRole(adminUserId, testFileId, 'ADMIN')).toBe(true);
        expect(hasFileRole(adminUserId, testFileId, 'OWNER')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return false for null userId', () => {
        expect(hasFileRole(null, testFileId, 'VIEWER')).toBe(false);
      });

      it('should return false for null fileId', () => {
        expect(hasFileRole(testUserId, null, 'VIEWER')).toBe(false);
      });

      it('should return false for null requiredRole', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, null)).toBe(false);
      });

      it('should return false for user with no access', () => {
        expect(hasFileRole(testUserId, testFileId, 'VIEWER')).toBe(false);
      });

      it('should return true for invalid required role (level 0)', () => {
        // Invalid roles get level 0, and any valid user role level >= 0
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(hasFileRole(testUserId, testFileId, 'INVALID')).toBe(true);
      });
    });
  });

  describe('FilePermissions convenience methods', () => {
    describe('canRead', () => {
      it('should return true for VIEWER', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(FilePermissions.canRead(testUserId, testFileId)).toBe(true);
      });

      it('should return true for higher roles', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(FilePermissions.canRead(testUserId, testFileId)).toBe(true);
      });

      it('should return false for no access', () => {
        expect(FilePermissions.canRead(testUserId, testFileId)).toBe(false);
      });
    });

    describe('canWrite', () => {
      it('should return false for VIEWER', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(FilePermissions.canWrite(testUserId, testFileId)).toBe(false);
      });

      it('should return true for EDITOR', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(FilePermissions.canWrite(testUserId, testFileId)).toBe(true);
      });

      it('should return true for ADMIN', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(FilePermissions.canWrite(testUserId, testFileId)).toBe(true);
      });

      it('should return true for OWNER', () => {
        expect(FilePermissions.canWrite(ownerUserId, testFileId)).toBe(true);
      });
    });

    describe('canShare', () => {
      it('should return false for VIEWER', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(FilePermissions.canShare(testUserId, testFileId)).toBe(false);
      });

      it('should return false for EDITOR', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(FilePermissions.canShare(testUserId, testFileId)).toBe(false);
      });

      it('should return true for ADMIN', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(FilePermissions.canShare(testUserId, testFileId)).toBe(true);
      });

      it('should return true for OWNER', () => {
        expect(FilePermissions.canShare(ownerUserId, testFileId)).toBe(true);
      });
    });

    describe('canDelete', () => {
      it('should return false for VIEWER', () => {
        grantFileAccess(testUserId, testFileId, 'VIEWER');
        expect(FilePermissions.canDelete(testUserId, testFileId)).toBe(false);
      });

      it('should return false for EDITOR', () => {
        grantFileAccess(testUserId, testFileId, 'EDITOR');
        expect(FilePermissions.canDelete(testUserId, testFileId)).toBe(false);
      });

      it('should return false for ADMIN', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(FilePermissions.canDelete(testUserId, testFileId)).toBe(false);
      });

      it('should return true for OWNER', () => {
        expect(FilePermissions.canDelete(ownerUserId, testFileId)).toBe(true);
      });
    });

    describe('canTransferOwnership', () => {
      it('should return false for ADMIN', () => {
        grantFileAccess(testUserId, testFileId, 'ADMIN');
        expect(FilePermissions.canTransferOwnership(testUserId, testFileId)).toBe(
          false,
        );
      });

      it('should return true for OWNER', () => {
        expect(
          FilePermissions.canTransferOwnership(ownerUserId, testFileId),
        ).toBe(true);
      });
    });
  });
});
