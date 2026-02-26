import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Trans } from 'react-i18next';

import { View } from '@actual-app/components/view';

import type { RemoteFile, SyncedLocalFile } from 'loot-core/types/file';

import { useAuth } from './AuthProvider';
import type { FilePermissions, Permissions } from './types';

import { useFilePermission } from '@desktop-client/hooks/useFilePermission';
import { useMetadataPref } from '@desktop-client/hooks/useMetadataPref';
import { useSelector } from '@desktop-client/redux';

type ProtectedRouteProps = {
  permission?: Permissions;
  filePermission?: FilePermissions;
  element: ReactElement;
  validateOwner?: boolean;
};

export const ProtectedRoute = ({
  element,
  permission,
  filePermission,
  validateOwner,
}: ProtectedRouteProps) => {
  const { hasPermission } = useAuth();
  const {
    canRead,
    canWrite,
    canShare,
    canDelete,
    userFileRole,
  } = useFilePermission();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [cloudFileId] = useMetadataPref('cloudFileId');
  const allFiles = useSelector(state => state.budgetfiles.allFiles || []);
  const remoteFiles = allFiles.filter(
    (f): f is SyncedLocalFile | RemoteFile =>
      f.state === 'remote' || f.state === 'synced' || f.state === 'detached',
  );
  const currentFile = remoteFiles.find(f => f.cloudFileId === cloudFileId);
  const userData = useSelector(state => state.user.data);

  useEffect(() => {
    // Check file-level permission first if specified
    if (filePermission) {
      let hasFileAccess = false;
      switch (filePermission) {
        case 'VIEWER':
          hasFileAccess = canRead;
          break;
        case 'EDITOR':
          hasFileAccess = canWrite;
          break;
        case 'ADMIN':
          hasFileAccess = canShare;
          break;
        case 'OWNER':
          hasFileAccess = canDelete;
          break;
        default:
          hasFileAccess = !!userFileRole;
      }
      setPermissionGranted(hasFileAccess);
      return;
    }

    // Fall back to server-level permission check
    if (permission) {
      const hasRequiredPermission = hasPermission(permission);
      setPermissionGranted(hasRequiredPermission);

      if (!hasRequiredPermission && validateOwner) {
        if (currentFile) {
          setPermissionGranted(
            currentFile.usersWithAccess.some(u => u.userId === userData?.userId),
          );
        }
      }
    } else {
      // No permission required
      setPermissionGranted(true);
    }
  }, [
    cloudFileId,
    permission,
    filePermission,
    validateOwner,
    hasPermission,
    currentFile,
    userData,
    canRead,
    canWrite,
    canShare,
    canDelete,
    userFileRole,
  ]);

  return permissionGranted ? (
    element
  ) : (
    <View
      style={{
        margin: '50px',
      }}
    >
      <h3>
        <Trans>You don't have permission to view this page</Trans>
      </h3>
    </View>
  );
};
