export type AdminRole =
  | 'ADMIN'
  | 'MODERATOR'
  | 'SUPPORT'
  | 'KYC_REVIEWER'
  | 'SERVICE_REVIEWER';

export interface AdminAccount {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  roles: AdminRole[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface AdminLoginData {
  accessToken: string;
  account: AdminAccount;
}
