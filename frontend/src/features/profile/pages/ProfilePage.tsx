import {
  Avatar,
  Button,
  Group,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppCard } from '../../../components/ui/AppCard';
import { PageContainer } from '../../../components/ui/PageContainer';
import { apiClient } from '../../../shared/api/client';
import type { UserResponse } from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  avatarUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: 'Avatar URL must start with http:// or https://',
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  const profileQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserResponse>('/users/me');
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const { data } = await apiClient.patch<UserResponse>('/users/me', values);
      return data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      form.reset({
        fullName: data.user.fullName,
        avatarUrl: data.user.avatarUrl ?? '',
      });
      notifications.show({
        color: 'teal',
        title: 'Profile updated',
        message: 'Your profile changes were saved.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Profile update failed',
        message: getApiErrorMessage(error),
      });
    },
  });

  const resolvedUser = profileQuery.data?.user ?? user;

  useEffect(() => {
    if (profileQuery.isSuccess) {
      setUser(profileQuery.data.user);
      form.reset({
        fullName: profileQuery.data.user.fullName,
        avatarUrl: profileQuery.data.user.avatarUrl ?? '',
      });
    }
  }, [form, profileQuery.data, profileQuery.isSuccess, setUser]);

  const onSubmit = form.handleSubmit((values) => {
    updateMutation.mutate({
      fullName: values.fullName,
      avatarUrl: values.avatarUrl,
    });
  });

  return (
    <PageContainer>
      <Stack>
        <Title order={2}>Profile</Title>
        <Text c="dimmed">Account settings, preferences, and workspace defaults.</Text>

        <AppCard p="lg">
          {profileQuery.isLoading ? (
            <Stack>
              <Skeleton h={72} radius="lg" />
              <Skeleton h={48} radius="md" />
              <Skeleton h={48} radius="md" />
            </Stack>
          ) : (
            <Stack gap="lg">
              <Group>
                <Avatar
                  size={64}
                  radius="xl"
                  src={resolvedUser?.avatarUrl ?? undefined}
                >
                  {resolvedUser?.fullName?.slice(0, 1) ?? 'U'}
                </Avatar>
                <Stack gap={2}>
                  <Text fw={600}>{resolvedUser?.fullName ?? 'Unknown User'}</Text>
                  <Text c="dimmed" size="sm">
                    {resolvedUser?.email ?? 'No email'}
                  </Text>
                </Stack>
              </Group>

              <form onSubmit={onSubmit}>
                <Stack>
                  <TextInput
                    label="Full name"
                    placeholder="Jane Doe"
                    {...form.register('fullName')}
                    error={form.formState.errors.fullName?.message}
                  />
                  <TextInput
                    label="Avatar URL"
                    placeholder="https://example.com/avatar.png"
                    {...form.register('avatarUrl')}
                    error={form.formState.errors.avatarUrl?.message}
                  />
                  <Button
                    type="submit"
                    loading={updateMutation.isPending}
                    w={{ base: '100%', sm: 'auto' }}
                  >
                    Save changes
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    w={{ base: '100%', sm: 'auto' }}
                    onClick={() => {
                      clearAuth();
                      navigate('/login', { replace: true });
                    }}
                  >
                    Sign out
                  </Button>
                </Stack>
              </form>
            </Stack>
          )}
        </AppCard>
      </Stack>
    </PageContainer>
  );
}
