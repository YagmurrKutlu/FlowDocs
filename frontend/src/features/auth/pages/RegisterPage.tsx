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

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(8, 'Confirm your password.'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      return data;
    },
    onSuccess: (data) => {
      setAuth({
        accessToken: data.accessToken,
        user: data.user,
      });
      notifications.show({
        color: 'teal',
        title: 'Account created',
        message: `Welcome to FlowDocs, ${data.user.fullName}.`,
      });
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Registration failed',
        message: getApiErrorMessage(error),
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    registerMutation.mutate(values);
  });

  return (
    <Stack align="center" justify="center" mih="100vh" p="lg">
      <AppCard w={420} p="xl" radius="lg">
        <Stack>
          <Title order={2}>Create your account</Title>
          <Text c="dimmed">Set up your workspace and invite your team.</Text>

          <form onSubmit={onSubmit}>
            <Stack>
              <TextInput
                label="Full name"
                placeholder="Jane Doe"
                {...form.register('fullName')}
                error={form.formState.errors.fullName?.message}
              />

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

              <PasswordInput
                label="Confirm password"
                placeholder="********"
                {...form.register('confirmPassword')}
                error={form.formState.errors.confirmPassword?.message}
              />

              <Button
                fullWidth
                type="submit"
                loading={registerMutation.isPending}
              >
                Create account
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed">
            Already registered?{' '}
            <Anchor component={Link} to="/login">
              Sign in
            </Anchor>
          </Text>
        </Stack>
      </AppCard>
    </Stack>
  );
}
