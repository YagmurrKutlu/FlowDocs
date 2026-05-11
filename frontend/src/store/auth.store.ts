import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  setAuth: (payload: { accessToken: string; user: AuthUser }) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
  markAuthResolved: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isAuthResolved: false,
      setAuth: ({ accessToken, user }) => {
        set({
          accessToken,
          user,
          isAuthenticated: true,
        });
      },
      setUser: (user) => {
        set({
          user,
          isAuthenticated: true,
        });
      },
      clearAuth: () => {
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
        });
      },
      markAuthResolved: () => {
        set({
          isAuthResolved: true,
        });
      },
    }),
    {
      name: 'flowdocs-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markAuthResolved();
      },
    },
  ),
);
