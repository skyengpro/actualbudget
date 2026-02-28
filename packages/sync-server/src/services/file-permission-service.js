import { getAccountDb, isAdmin } from '../account-db';
import { getFileOwnerId } from './user-service';

/**
 * File role constants with their hierarchy levels.
 * Higher level = more permissions.
 */
export const FileRole = {
  VIEWER: 'VIEWER',
  EDITOR: 'EDITOR',
  ADMIN: 'ADMIN',
  OWNER: 'OWNER',
};

/**
 * Role level mapping for permission comparison.
 */
const RoleLevels = {
  VIEWER: 10,
  EDITOR: 20,
  ADMIN: 30,
  OWNER: 40,
};

/**
 * Get the role level for a given role string.
 * @param {string} role - The role string
 * @returns {number} The role level, or 0 if invalid
 */
function getRoleLevel(role) {
  return RoleLevels[role] || 0;
}

/**
 * Validates if a given role string is a valid file role.
 * @param {string} role - The role string to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateFileRole(role) {
  return Object.values(FileRole).includes(role);
}

/**
 * Get the user's role for a specific file.
 * Returns OWNER if user owns the file, otherwise returns the role from user_access.
 * @param {string} userId - The user ID
 * @param {string} fileId - The file ID
 * @returns {string|null} The role string (VIEWER, EDITOR, ADMIN, OWNER) or null if no access
 */
export function getUserFileRole(userId, fileId) {
  if (!userId || !fileId) {
    return null;
  }

  const accountDb = getAccountDb();

  // Check if user is the file owner
  const fileOwner = getFileOwnerId(fileId);
  if (fileOwner === userId) {
    return FileRole.OWNER;
  }

  // Check user_access table for explicit role
  const access = accountDb.first(
    'SELECT role FROM user_access WHERE user_id = ? AND file_id = ?',
    [userId, fileId],
  );

  return access?.role || null;
}

/**
 * Check if a user has at least the required role level for a file.
 * Server admins always have access.
 * @param {string} userId - The user ID
 * @param {string} fileId - The file ID
 * @param {string} requiredRole - The minimum required role (VIEWER, EDITOR, ADMIN, OWNER)
 * @returns {boolean} True if user has sufficient permissions
 */
export function hasFileRole(userId, fileId, requiredRole) {
  if (!userId || !fileId || !requiredRole) {
    return false;
  }

  // Server admins bypass file-level permissions
  if (isAdmin(userId)) {
    return true;
  }

  const userRole = getUserFileRole(userId, fileId);
  if (!userRole) {
    return false;
  }

  const userLevel = getRoleLevel(userRole);
  const requiredLevel = getRoleLevel(requiredRole);

  return userLevel >= requiredLevel;
}

/**
 * File permission checking functions.
 * Each function checks if a user has the required permission for a file.
 */
export const FilePermissions = {
  /**
   * Check if user can read/view the file (requires VIEWER role or higher)
   */
  canRead: (userId, fileId) => hasFileRole(userId, fileId, FileRole.VIEWER),

  /**
   * Check if user can write/sync changes to the file (requires EDITOR role or higher)
   */
  canWrite: (userId, fileId) => hasFileRole(userId, fileId, FileRole.EDITOR),

  /**
   * Check if user can share the file with others (requires ADMIN role or higher)
   */
  canShare: (userId, fileId) => hasFileRole(userId, fileId, FileRole.ADMIN),

  /**
   * Check if user can delete the file (requires OWNER role)
   */
  canDelete: (userId, fileId) => hasFileRole(userId, fileId, FileRole.OWNER),

  /**
   * Check if user can transfer ownership (requires OWNER role)
   */
  canTransferOwnership: (userId, fileId) =>
    hasFileRole(userId, fileId, FileRole.OWNER),
};
