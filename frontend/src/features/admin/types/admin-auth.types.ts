export interface AdminAccount {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  roles: string[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface AdminLoginData {
  accessToken: string;
  account: AdminAccount;
}
