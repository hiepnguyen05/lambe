import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';
import { useDialog } from '../../../components/ui/DialogProvider';
import type { AdminLoginData } from '../types/admin-auth.types';

export function useAdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAdminAuth();
  const { showDialog } = useDialog();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await apiRequest<{ data: AdminLoginData }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      if (response?.data?.accessToken) {
        login(response.data.accessToken, response.data.account);
        showDialog({
          title: 'Thành công',
          message: 'Đăng nhập thành công! Đang chuyển hướng...',
          type: 'success',
          confirmText: 'Đóng'
        });
        navigate('/admin');
      } else {
        throw new Error('No access token received');
      }
    } catch (error: any) {
      showDialog({
        title: 'Đăng nhập thất bại',
        message: error.message || "Vui lòng kiểm tra lại thông tin tài khoản và mật khẩu.",
        type: 'error',
        confirmText: 'Thử lại'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    isLoading,
    handleSubmit
  };
}
