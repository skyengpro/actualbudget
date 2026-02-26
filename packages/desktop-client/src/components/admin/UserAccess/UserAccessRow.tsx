// @ts-strict-ignore
import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import { getUserAccessErrors } from 'loot-core/shared/errors';
import type { UserAvailable } from 'loot-core/types/models';

import { Checkbox } from '@desktop-client/components/forms';
import { Cell, Row } from '@desktop-client/components/table';
import { useFilePermission } from '@desktop-client/hooks/useFilePermission';
import { useMetadataPref } from '@desktop-client/hooks/useMetadataPref';
import { addNotification } from '@desktop-client/notifications/notificationsSlice';
import { useDispatch } from '@desktop-client/redux';
import { signOut } from '@desktop-client/users/usersSlice';

type UserAccessProps = {
  access: UserAvailable;
  hovered?: boolean;
  onHover?: (id: string | null) => void;
  onRoleChange?: () => void;
};

type FileRole = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'OWNER';

const roleOptions: [FileRole, string][] = [
  ['VIEWER', 'Viewer'],
  ['EDITOR', 'Editor'],
  ['ADMIN', 'Admin'],
];

export const UserAccessRow = memo(
  ({ access, hovered, onHover, onRoleChange }: UserAccessProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { canShare } = useFilePermission();

    const backgroundFocus = hovered;
    const [marked, setMarked] = useState(
      access.owner === 1 || access.haveAccess === 1,
    );
    const [currentRole, setCurrentRole] = useState<FileRole>(
      (access.role as FileRole) || (access.owner === 1 ? 'OWNER' : 'EDITOR'),
    );
    const [cloudFileId] = useMetadataPref('cloudFileId');

    const isOwner = access.owner === 1;

    const handleAccessToggle = async () => {
      const newValue = !marked;
      if (newValue) {
        const { error } = await send('access-add', {
          fileId: cloudFileId as string,
          userId: access.userId,
          role: 'EDITOR',
        });

        if (error) {
          handleError(error);
        } else {
          setCurrentRole('EDITOR');
        }
      } else {
        const result = await send('access-delete-all', {
          fileId: cloudFileId as string,
          ids: [access.userId],
        });

        if ('someDeletionsFailed' in result && result.someDeletionsFailed) {
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                title: t('Access Revocation Incomplete'),
                message: t(
                  'Some access permissions were not revoked successfully.',
                ),
                sticky: true,
              },
            }),
          );
        }
      }
      setMarked(newValue);
      onRoleChange?.();
    };

    const handleRoleChange = async (newRole: FileRole) => {
      const { error } = await send('access-update', {
        fileId: cloudFileId as string,
        userId: access.userId,
        role: newRole,
      });

      if (error) {
        handleError(error);
      } else {
        setCurrentRole(newRole);
        onRoleChange?.();
      }
    };

    const handleError = (error: string) => {
      if (error === 'token-expired') {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              id: 'login-expired',
              title: t('Login expired'),
              sticky: true,
              message: getUserAccessErrors(error),
              button: {
                title: t('Go to login'),
                action: () => {
                  void dispatch(signOut());
                },
              },
            },
          }),
        );
      } else {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              title: t('Something happened while editing access'),
              sticky: true,
              message: getUserAccessErrors(error),
            },
          }),
        );
      }
    };

    return (
      <Row
        height="auto"
        style={{
          fontSize: 13,
          backgroundColor: backgroundFocus
            ? theme.tableRowBackgroundHover
            : theme.tableBackground,
        }}
        collapsed
        onMouseEnter={() => onHover && onHover(access.userId)}
        onMouseLeave={() => onHover && onHover(null)}
      >
        <Cell
          width={100}
          plain
          style={{ padding: '0 15px', paddingLeft: 5, alignItems: 'center' }}
        >
          <Checkbox
            defaultChecked={marked}
            disabled={isOwner || !canShare}
            onClick={handleAccessToggle}
          />
        </Cell>
        <Cell
          name="displayName"
          width="flex"
          plain
          style={{ color: theme.tableText }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              padding: '3px 5px',
            }}
          >
            <span>{access.displayName ?? access.userName}</span>
          </View>
        </Cell>
        <Cell
          name="role"
          width={120}
          plain
          style={{ color: theme.tableText, padding: '0 10px' }}
        >
          {isOwner ? (
            <span style={{ fontWeight: 500 }}>{t('Owner')}</span>
          ) : marked ? (
            <Select
              options={roleOptions}
              value={currentRole}
              onChange={(value: string) => handleRoleChange(value as FileRole)}
              disabled={!canShare}
              style={{ minWidth: 90 }}
            />
          ) : (
            <span style={{ color: theme.pageTextLight }}>—</span>
          )}
        </Cell>
        <Cell
          name="owner"
          width={100}
          plain
          style={{ color: theme.tableText }}
        >
          <View
            style={{ padding: '0 15px', paddingLeft: 5, alignItems: 'center' }}
          >
            <Checkbox checked={isOwner} disabled={true} />
          </View>
        </Cell>
      </Row>
    );
  },
);

UserAccessRow.displayName = 'UserRow';
