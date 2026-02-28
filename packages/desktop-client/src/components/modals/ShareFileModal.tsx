import React, { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { send } from 'loot-core/platform/client/connection';
import type { FileRole, UserAvailable } from 'loot-core/types/models';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
} from '@desktop-client/components/common/Modal';
import type { Modal as ModalType } from '@desktop-client/modals/modalsSlice';

type ShareFileModalProps = Extract<
  ModalType,
  { name: 'share-file' }
>['options'];

type UserWithAccess = {
  userId: string;
  displayName: string;
  userName: string;
  role: FileRole;
  isOwner: boolean;
};

const ROLE_OPTIONS: [FileRole, string][] = [
  ['VIEWER', 'Viewer'],
  ['EDITOR', 'Editor'],
  ['ADMIN', 'Admin'],
];

export function ShareFileModal({ fileId, fileName }: ShareFileModalProps) {
  const { t } = useTranslation();
  const [usersWithAccess, setUsersWithAccess] = useState<UserWithAccess[]>([]);
  const [allUsers, setAllUsers] = useState<
    { id: string; displayName: string; userName: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<FileRole>('EDITOR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersWithAccess = useCallback(async () => {
    try {
      const data = await send('access-get-available-users', fileId);

      if ('error' in data) {
        setError(data.error);
        return;
      }

      // Map API response to component's expected format
      // Filter to only users with access
      const usersWithAccessMapped = (data as UserAvailable[])
        .filter(u => u.haveAccess === 1)
        .map(u => ({
          userId: u.userId,
          displayName: u.displayName || u.userName,
          userName: u.userName,
          role: (u.role || 'EDITOR') as FileRole,
          isOwner: u.owner === 1,
        }));
      setUsersWithAccess(usersWithAccessMapped);

      // Also set all users for the add dropdown (those without access)
      const usersWithoutAccess = (data as UserAvailable[])
        .filter(u => u.haveAccess !== 1)
        .map(u => ({
          id: u.userId,
          displayName: u.displayName || u.userName,
          userName: u.userName,
        }));
      setAllUsers(usersWithoutAccess);
    } catch (err) {
      console.error('Error fetching users with access:', err);
      setError(t('Failed to load users'));
    }
  }, [fileId, t]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchUsersWithAccess();
      setLoading(false);
    };
    loadData();
  }, [fetchUsersWithAccess]);

  const handleAddUser = async () => {
    if (!selectedUserId) {
      setError(t('Please select a user'));
      return;
    }

    try {
      const result = await send('access-add', {
        fileId,
        userId: selectedUserId,
        role: selectedRole,
      });

      if (result && 'error' in result && result.error) {
        setError(result.error);
      } else {
        setSelectedUserId('');
        setError(null);
        await fetchUsersWithAccess();
      }
    } catch (err) {
      setError(t('Failed to add user'));
    }
  };

  const handleRoleChange = async (userId: string, newRole: FileRole) => {
    try {
      const result = await send('access-update', {
        fileId,
        userId,
        role: newRole,
      });

      if (result && 'error' in result && result.error) {
        setError(result.error);
      } else {
        await fetchUsersWithAccess();
      }
    } catch (err) {
      setError(t('Failed to update role'));
    }
  };

  const handleRemoveAccess = async (userId: string) => {
    try {
      const result = await send('access-delete-all', {
        fileId,
        ids: [userId],
      });

      if (result && 'error' in result && result.error) {
        setError(String(result.error));
      } else {
        await fetchUsersWithAccess();
      }
    } catch (err) {
      setError(t('Failed to remove access'));
    }
  };

  // allUsers is already filtered to only include users without access
  const availableUsers = allUsers;

  return (
    <Modal name="share-file" containerProps={{ style: { width: 500 } }}>
      {({ state: { close } }) => (
        <>
          <ModalHeader
            title={t('Share "{{fileName}}"', { fileName })}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <View style={{ padding: 15 }}>
            {loading ? (
              <Text style={{ color: theme.pageTextLight }}>
                <Trans>Loading...</Trans>
              </Text>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Error message */}
                {error && (
                  <Text style={{ color: theme.errorText, marginBottom: 10 }}>
                    {error}
                  </Text>
                )}

                {/* Users with access */}
                <Text
                  style={{
                    fontWeight: 600,
                    marginBottom: 10,
                    color: theme.pageTextLight,
                  }}
                >
                  <Trans>People with access</Trans>
                </Text>

                {usersWithAccess.length === 0 ? (
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>No users have access to this file yet.</Trans>
                  </Text>
                ) : (
                  <View style={{ marginBottom: 20 }}>
                    {usersWithAccess.map(user => (
                      <View
                        key={user.userId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: `1px solid ${theme.tableBorder}`,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: 500 }}>
                            {user.displayName || user.userName}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: theme.pageTextSubdued,
                            }}
                          >
                            {user.userName}
                          </Text>
                        </View>

                        {user.isOwner ? (
                          <Text
                            style={{
                              color: theme.pageTextSubdued,
                              fontStyle: 'italic',
                              marginRight: 10,
                            }}
                          >
                            <Trans>Owner</Trans>
                          </Text>
                        ) : (
                          <View
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Select
                              options={ROLE_OPTIONS}
                              value={user.role}
                              onChange={(newRole: string) =>
                                handleRoleChange(user.userId, newRole as FileRole)
                              }
                              style={{ marginRight: 10 }}
                            />
                            <Button
                              variant="bare"
                              onPress={() => handleRemoveAccess(user.userId)}
                              style={{ color: theme.errorText }}
                            >
                              <Trans>Remove</Trans>
                            </Button>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Add new user */}
                <Text
                  style={{
                    fontWeight: 600,
                    marginBottom: 10,
                    marginTop: 10,
                    color: theme.pageTextLight,
                  }}
                >
                  <Trans>Add people</Trans>
                </Text>

                {availableUsers.length === 0 ? (
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>All users already have access to this file.</Trans>
                  </Text>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Select
                      options={[
                        ['', t('Select user...')] as [string, string],
                        ...availableUsers.map(
                          u =>
                            [u.id, u.displayName || u.userName] as [
                              string,
                              string,
                            ],
                        ),
                      ]}
                      value={selectedUserId}
                      onChange={(value: string) => setSelectedUserId(value)}
                      style={{ flex: 1 }}
                    />
                    <Select
                      options={ROLE_OPTIONS}
                      value={selectedRole}
                      onChange={(value: string) =>
                        setSelectedRole(value as FileRole)
                      }
                    />
                    <Button variant="primary" onPress={handleAddUser}>
                      <Trans>Add</Trans>
                    </Button>
                  </View>
                )}

                {/* Role descriptions */}
                <View
                  style={{
                    marginTop: 20,
                    padding: 15,
                    backgroundColor: theme.tableBackground,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: 600,
                      marginBottom: 8,
                      color: theme.pageTextLight,
                    }}
                  >
                    <Trans>Role Permissions</Trans>
                  </Text>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                      <Trans>
                        <strong>Viewer:</strong> Can view the budget but cannot
                        make changes
                      </Trans>
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                      <Trans>
                        <strong>Editor:</strong> Can view and edit the budget
                      </Trans>
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                      <Trans>
                        <strong>Admin:</strong> Can view, edit, and share the
                        budget with others
                      </Trans>
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
