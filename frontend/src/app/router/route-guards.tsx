import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export function ProtectedRoute() {
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthResolved) {
    return (
      <Center mih="100vh">
        <Loader color="violet" />
      </Center>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate replace to="/login" />;
}

export function PublicRoute() {
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthResolved) {
    return (
      <Center mih="100vh">
        <Loader color="violet" />
      </Center>
    );
  }

  return isAuthenticated ? <Navigate replace to="/dashboard" /> : <Outlet />;
}
