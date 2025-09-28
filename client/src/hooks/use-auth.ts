import { useState, useEffect } from 'react';
import type { User } from '@shared/schema';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
  });

  useEffect(() => {
    // Check for stored user data on app load
    const storedUser = localStorage.getItem('favr_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAuthState({
          user,
          isAuthenticated: true,
          loading: false,
        });
      } catch (error) {
        localStorage.removeItem('favr_user');
        setAuthState({
          user: null,
          isAuthenticated: false,
          loading: false,
        });
      }
    } else {
      setAuthState({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  }, []);

  const login = (userData: User) => {
    setAuthState({
      user: userData,
      isAuthenticated: true,
      loading: false,
    });
    localStorage.setItem('favr_user', JSON.stringify(userData));
    localStorage.setItem('currentUserId', userData.id.toString());
  };

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false,
    });
    localStorage.removeItem('favr_user');
  };

  return {
    ...authState,
    login,
    logout,
  };
}