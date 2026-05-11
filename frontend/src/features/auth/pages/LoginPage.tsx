import {
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppCard } from '../../../components/ui/AppCard';
import { apiClient } from '../../../shared/api/client';
import type { AuthResponse } from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', values);
      return data;
    },
    onSuccess: (data) => {
      setAuth({
        accessToken: data.accessToken,
        user: data.user,
      });
      notifications.show({
        color: 'teal',
        title: 'Signed in',
        message: `Welcome back, ${data.user.fullName}.`,
      });
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Sign in failed',
        message: getApiErrorMessage(error),
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values);
  });

  return (
    <Stack align="center" justify="center" mih="100vh" p="lg">
      <AppCard w={420} p="xl" radius="lg">
        <Stack>
          <Title order={2}>Welcome back</Title>
          <Text c="dimmed">Sign in to continue collaborating in FlowDocs.</Text>

          <form onSubmit={onSubmit}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="team@flowdocs.app"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />

              <PasswordInput
                label="Password"
                placeholder="********"
                {...form.register('password')}
                error={form.formState.errors.password?.message}
              />

              <Button
                fullWidth
                type="submit"
                loading={loginMutation.isPending}
              >
                Sign in
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed">
            No account yet?{' '}
            <Anchor component={Link} to="/register">
              Create one
            </Anchor>
          </Text>
        </Stack>
      </AppCard>
    </Stack>
  );
}
