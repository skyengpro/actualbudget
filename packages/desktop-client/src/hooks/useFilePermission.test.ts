import { renderHook } from '@testing-library/react';
import React from 'react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { FilePermissions } from '@desktop-client/auth/types';
import { useFilePermission } from './useFilePermission';

// Mock the useAuth hook
const mockHasPermission = vi.fn();
vi.mock('@desktop-client/auth/AuthProvider', () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
  }),
}));

// Mock useMetadataPref hook
const mockCloudFileId = vi.fn();
vi.mock('@desktop-client/hooks/useMetadataPref', () => ({
  useMetadataPref: (key: string) => {
    if (key === 'cloudFileId') {
      return [mockCloudFileId()];
    }
    return [null];
  },
}));

// Create a minimal mock store
function createMockStore(state: {
  budgetfiles?: { allFiles: unknown[] };
  user?: { data: { userId?: string } | null };
}) {
  return {
    getState: () => ({
      budgetfiles: state.budgetfiles || { allFiles: [] },
      user: state.user || { data: null },
    }),
    subscribe: vi.fn(() => vi.fn()),
    dispatch: vi.fn(),
    replaceReducer: vi.fn(),
    [Symbol.observable]: vi.fn(),
  };
}

function createWrapper(store: ReturnType<typeof createMockStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(Provider, { store: store as never, children });
  };
}

describe('useFilePermission', () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(false);
    mockCloudFileId.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('server admin permissions', () => {
    it('should return full permissions for server admin', () => {
      mockHasPermission.mockReturnValue(true); // isAdmin
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'VIEWER' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.isServerAdmin).toBe(true);
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canTransferOwnership).toBe(true);
      expect(result.current.canAccessSettings).toBe(true);
      expect(result.current.canManageAccounts).toBe(true);
    });
  });

  describe('VIEWER role permissions', () => {
    it('should return canRead=true and canWrite=false for VIEWER role', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'VIEWER' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.VIEWER);
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(false);
      expect(result.current.canShare).toBe(false);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.canTransferOwnership).toBe(false);
      expect(result.current.canAccessSettings).toBe(false);
      expect(result.current.canManageAccounts).toBe(false);
    });
  });

  describe('EDITOR role permissions', () => {
    it('should return canWrite=true for EDITOR role', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'EDITOR' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.EDITOR);
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(false);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.canAccessSettings).toBe(false);
      expect(result.current.canManageAccounts).toBe(false);
    });
  });

  describe('ADMIN role permissions', () => {
    it('should return canShare=true for ADMIN role', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'ADMIN' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.ADMIN);
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(true);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.canTransferOwnership).toBe(false);
      expect(result.current.canAccessSettings).toBe(true);
      expect(result.current.canManageAccounts).toBe(true);
    });
  });

  describe('OWNER role permissions', () => {
    it('should return full file permissions for OWNER role', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: true, role: 'OWNER' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.OWNER);
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canTransferOwnership).toBe(true);
      expect(result.current.canAccessSettings).toBe(true);
      expect(result.current.canManageAccounts).toBe(true);
    });

    it('should detect owner via owner flag even without OWNER role string', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: true }], // No role string
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.OWNER);
      expect(result.current.canDelete).toBe(true);
    });
  });

  describe('default permissions when role is unknown', () => {
    it('should default to full permissions when no role information is available', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [], // No access entries
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      // When role is unknown, defaults to full permissions to avoid blocking
      expect(result.current.userFileRole).toBeNull();
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(true);
      expect(result.current.canDelete).toBe(true);
    });

    it('should default to full permissions when no cloud file ID', () => {
      mockCloudFileId.mockReturnValue(null);

      const store = createMockStore({
        budgetfiles: { allFiles: [] },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBeNull();
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
    });

    it('should default to full permissions when user data is not loaded', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'VIEWER' }],
            },
          ],
        },
        user: { data: null }, // User not loaded
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBeNull();
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
    });
  });

  describe('file state handling', () => {
    it('should work with remote files', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'remote',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'EDITOR' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.EDITOR);
      expect(result.current.canWrite).toBe(true);
    });

    it('should work with detached files', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'detached',
              cloudFileId: 'file-123',
              usersWithAccess: [{ userId: 'user-1', owner: false, role: 'ADMIN' }],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.userFileRole).toBe(FilePermissions.ADMIN);
      expect(result.current.canShare).toBe(true);
    });

    it('should ignore local-only files', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'local',
              cloudFileId: 'file-123', // This wouldn't normally exist for local files
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      // Local files are filtered out, so no file found
      expect(result.current.userFileRole).toBeNull();
      expect(result.current.canRead).toBe(true); // Default permissions
    });
  });

  describe('backwards compatibility', () => {
    it('should handle legacy access entries without role (defaults to EDITOR)', () => {
      mockCloudFileId.mockReturnValue('file-123');

      const store = createMockStore({
        budgetfiles: {
          allFiles: [
            {
              state: 'synced',
              cloudFileId: 'file-123',
              usersWithAccess: [
                { userId: 'user-1', owner: false }, // No role field
              ],
            },
          ],
        },
        user: { data: { userId: 'user-1' } },
      });

      const { result } = renderHook(() => useFilePermission(), {
        wrapper: createWrapper(store),
      });

      // Falls through to default case which returns EDITOR for non-owners
      expect(result.current.userFileRole).toBe(FilePermissions.EDITOR);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canShare).toBe(false);
    });
  });
});
