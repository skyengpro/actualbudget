import { useMemo } from 'react';

import type { RemoteFile, SyncedLocalFile } from 'loot-core/types/file';

import { useAuth } from '@desktop-client/auth/AuthProvider';
import { FilePermissions, Permissions } from '@desktop-client/auth/types';
import { useMetadataPref } from '@desktop-client/hooks/useMetadataPref';
import { useSelector } from '@desktop-client/redux';

type FilePermissionResult = {
  /** The user's role for the current file */
  userFileRole: FilePermissions | null;
  /** Whether the user is a server admin */
  isServerAdmin: boolean;
  /** Whether the user can read/view the file */
  canRead: boolean;
  /** Whether the user can write/sync changes to the file */
  canWrite: boolean;
  /** Whether the user can share the file with others */
  canShare: boolean;
  /** Whether the user can delete the file */
  canDelete: boolean;
  /** Whether the user can transfer ownership */
  canTransferOwnership: boolean;
  /** Whether the user can access settings (ADMIN or OWNER, not EDITOR) */
  canAccessSettings: boolean;
  /** Whether the user can create/delete accounts (ADMIN or OWNER, not EDITOR) */
  canManageAccounts: boolean;
};

const RoleLevels: Record<FilePermissions, number> = {
  [FilePermissions.VIEWER]: 10,
  [FilePermissions.EDITOR]: 20,
  [FilePermissions.ADMIN]: 30,
  [FilePermissions.OWNER]: 40,
};

function hasRoleLevel(
  userRole: FilePermissions | null,
  requiredRole: FilePermissions,
): boolean {
  if (!userRole) return false;
  return RoleLevels[userRole] >= RoleLevels[requiredRole];
}

/**
 * Hook to check file-level permissions for the current user.
 * Returns the user's role and permission flags for the current budget file.
 */
export function useFilePermission(): FilePermissionResult {
  const { hasPermission } = useAuth();
  const [cloudFileId] = useMetadataPref('cloudFileId');
  const allFiles = useSelector(state => state.budgetfiles.allFiles || []);
  const userData = useSelector(state => state.user.data);

  const isServerAdmin = hasPermission(Permissions.ADMINISTRATOR);

  const currentFile = useMemo(() => {
    if (!cloudFileId) return null;

    const remoteFiles = allFiles.filter(
      (f): f is SyncedLocalFile | RemoteFile =>
        f.state === 'remote' || f.state === 'synced' || f.state === 'detached',
    );

    return remoteFiles.find(f => f.cloudFileId === cloudFileId) || null;
  }, [allFiles, cloudFileId]);

  const userFileRole = useMemo((): FilePermissions | null => {
    if (!currentFile || !userData?.userId) return null;

    // Check if user is the file owner
    const isOwner = currentFile.usersWithAccess?.some(
      u => u.userId === userData.userId && u.owner,
    );
    if (isOwner) {
      return FilePermissions.OWNER;
    }

    // Find the user's access entry
    const userAccess = currentFile.usersWithAccess?.find(
      u => u.userId === userData.userId,
    );

    if (!userAccess) return null;

    // Map role string to FilePermissions enum
    switch (userAccess.role) {
      case 'VIEWER':
        return FilePermissions.VIEWER;
      case 'EDITOR':
        return FilePermissions.EDITOR;
      case 'ADMIN':
        return FilePermissions.ADMIN;
      case 'OWNER':
        return FilePermissions.OWNER;
      default:
        // Default to EDITOR for backwards compatibility
        return userAccess.owner ? FilePermissions.OWNER : FilePermissions.EDITOR;
    }
  }, [currentFile, userData?.userId]);

  // Server admins can do everything
  if (isServerAdmin) {
    return {
      userFileRole: userFileRole || FilePermissions.OWNER,
      isServerAdmin: true,
      canRead: true,
      canWrite: true,
      canShare: true,
      canDelete: true,
      canTransferOwnership: true,
      canAccessSettings: true,
      canManageAccounts: true,
    };
  }

  // If we don't have role information yet, default to full permissions
  // to avoid blocking legitimate users while data loads
  // Only restrict when we explicitly know the user's role
  if (!userFileRole) {
    return {
      userFileRole: null,
      isServerAdmin: false,
      canRead: true,
      canWrite: true,
      canShare: true,
      canDelete: true,
      canTransferOwnership: true,
      canAccessSettings: true,
      canManageAccounts: true,
    };
  }

  return {
    userFileRole,
    isServerAdmin: false,
    canRead: hasRoleLevel(userFileRole, FilePermissions.VIEWER),
    canWrite: hasRoleLevel(userFileRole, FilePermissions.EDITOR),
    canShare: hasRoleLevel(userFileRole, FilePermissions.ADMIN),
    canDelete: hasRoleLevel(userFileRole, FilePermissions.OWNER),
    canTransferOwnership: hasRoleLevel(userFileRole, FilePermissions.OWNER),
    // Settings and account management require ADMIN or higher (EDITOR cannot)
    canAccessSettings: hasRoleLevel(userFileRole, FilePermissions.ADMIN),
    canManageAccounts: hasRoleLevel(userFileRole, FilePermissions.ADMIN),
  };
}
