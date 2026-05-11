import { Loader, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { apiClient } from '../../shared/api/client';
import type { UserResponse } from '../../shared/api/contracts';
import { useAuthStore } from '../../store/auth.store';

export function AuthBootstrap({ children }: PropsWithChildren) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const restoreQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserResponse>('/auth/me');
      return data;
    },
    enabled: isAuthResolved && Boolean(accessToken),
    retry: false,
  });

  useEffect(() => {
    if (restoreQuery.isSuccess) {
      setUser(restoreQuery.data.user);
    }
  }, [restoreQuery.data, restoreQuery.isSuccess, setUser]);

  useEffect(() => {
    if (restoreQuery.isError) {
      clearAuth();
    }
  }, [clearAuth, restoreQuery.isError]);

  if (!isAuthResolved) {
    return (
      <Stack align="center" justify="center" mih="100vh" gap="sm">
        <Loader color="violet" />
        <Text c="dimmed" size="sm">
          Restoring your session...
        </Text>
      </Stack>
    );
  }

  if (!accessToken) {
    return children;
  }

  if (restoreQuery.isSuccess) {
    return children;
  }

  if (restoreQuery.isError) {
    return children;
  }

  return (
    <Stack align="center" justify="center" mih="100vh" gap="sm">
      <Loader color="violet" />
      <Text c="dimmed" size="sm">
        Restoring your session...
      </Text>
    </Stack>
  );
}
