import {
  Anchor,
  Button,
  PasswordInput,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '../../../shared/api/client';
import type { AuthResponse } from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import styles from './LoginPage.module.css';

const loginSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const fieldClassNames = {
  label: styles.fieldLabel,
  input: styles.fieldInput,
  error: styles.fieldError,
};

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
        title: 'Giriş başarılı',
        message: `Hoş geldiniz, ${data.user.fullName}.`,
      });
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Giriş başarısız',
        message: getApiErrorMessage(error),
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values);
  });

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoBadge}>
          <img
            src={`${import.meta.env.BASE_URL}flowdocs_icon.svg`}
            alt=""
            width={24}
            height={24}
            className={styles.logoMark}
            decoding="async"
          />
          <span className={styles.logoText}>FlowDocs</span>
        </div>

        <h1 className={styles.title}>Tekrar hoş geldiniz</h1>
        <p className={styles.subtitle}>
          FlowDocs üzerinde işbirliğine devam etmek için giriş yapın.
        </p>

        <form onSubmit={onSubmit}>
          <div className={styles.formStack}>
            <TextInput
              label="E-posta"
              placeholder="ornek@flowdocs.app"
              classNames={fieldClassNames}
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />

            <PasswordInput
              label="Şifre"
              placeholder="••••••••"
              classNames={{
                ...fieldClassNames,
                visibilityToggle: styles.visibilityToggle,
              }}
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />

            <Button
              className={styles.submitBtn}
              fullWidth
              type="submit"
              loading={loginMutation.isPending}
            >
              Giriş Yap
            </Button>
          </div>
        </form>

        <p className={styles.footer}>
          Henüz hesabınız yok mu?{' '}
          <Anchor component={Link} to="/register" className={styles.registerLink}>
            Hesap oluştur
          </Anchor>
        </p>
      </div>
    </div>
  );
}
