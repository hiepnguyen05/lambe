import React, { createContext, useState, useEffect } from 'react';
import { apiRequest } from '../../../lib/api-client';
import type { AdminAccount } from '../types/admin-auth.types';

const ADMIN_TOKEN_KEY = 'lambe_admin_token';

export interface AdminAuthContextType {
  token: string | null;
  account: AdminAccount | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (newToken: string, accountData?: AdminAccount) => void;
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(ADMIN_TOKEN_KEY));
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    const verifyToken = async () => {
      if (!token) {
        if (mounted) setIsInitializing(false);
        return;
      }
      try {
        const res = await apiRequest<{ data: { account: AdminAccount } }>('/admin/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (mounted) {
          setAccount(res.data.account);
        }
      } catch (error) {
        if (mounted) {
          setToken(null);
          setAccount(null);
          localStorage.removeItem(ADMIN_TOKEN_KEY);
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };
    verifyToken();
    return () => { mounted = false; };
  }, [token]);

  const login = (newToken: string, accountData?: AdminAccount) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    setToken(newToken);
    if (accountData) setAccount(accountData);
  };

  const logout = async () => {
    if (token) {
      try {
        await apiRequest('/admin/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        // Ignore errors on logout
      }
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setAccount(null);
  };

  const normalizedAccount =
    account && 'account' in (account as unknown as Record<string, unknown>)
      ? ((account as unknown as { account: AdminAccount }).account ?? null)
      : account;

  return (
    <AdminAuthContext.Provider value={{ token, account: normalizedAccount, isInitializing, isAuthenticated: !!token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
