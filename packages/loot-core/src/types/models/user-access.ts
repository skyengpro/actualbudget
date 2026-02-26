export type FileRole = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'OWNER';

export type NewUserAccessEntity = {
  fileId: string;
  userId: string;
  role?: FileRole;
};

export type UserAccessEntity = {
  displayName: string;
  userName: string;
  fileName: string;
  role?: FileRole;
  isOwner?: boolean;
} & Omit<NewUserAccessEntity, 'role'>;
