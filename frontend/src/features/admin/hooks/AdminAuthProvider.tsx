import React, { useState, useEffect } from 'react';
import {
  apiRequest,
  refreshAdminSession,
  setAdminAccessToken,
} from '../../../lib/api-client';
import type { AdminAccount } from '../types/admin-auth.types';
import { AdminAuthContext } from './admin-auth.context';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAdminAccessToken(null);
      setToken(null);
      setAccount(null);
    };
    window.addEventListener('lambe:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('lambe:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const session = await refreshAdminSession();
        if (mounted) {
          setToken(session.accessToken);
          setAccount(session.account as AdminAccount);
        }
      } catch {
        if (mounted) {
          setAdminAccessToken(null);
          setToken(null);
          setAccount(null);
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };
    void restoreSession();
    return () => { mounted = false; };
  }, []);

  const login = (newToken: string, accountData: AdminAccount) => {
    setAdminAccessToken(newToken);
    setToken(newToken);
    setAccount(accountData);
  };

  const logout = async () => {
    if (token) {
      try {
        await apiRequest('/admin/auth/logout', { method: 'POST' });
      } catch {
        // Ignore errors on logout
      }
    }
    setAdminAccessToken(null);
    setToken(null);
    setAccount(null);
  };

  return (
    <AdminAuthContext.Provider value={{ token, account, isInitializing, isAuthenticated: !!token && !!account, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
