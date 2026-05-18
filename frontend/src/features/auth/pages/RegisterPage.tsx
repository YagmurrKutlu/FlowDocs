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

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalıdır.'),
    email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
    password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(8, 'Şifrenizi tekrar girin.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Şifreler eşleşmiyor.',
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const fieldClassNames = {
  label: styles.fieldLabel,
  input: styles.fieldInput,
  error: styles.fieldError,
};

const passwordClassNames = {
  ...fieldClassNames,
  visibilityToggle: styles.visibilityToggle,
};

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
        title: 'Hesap oluşturuldu',
        message: `FlowDocs'a hoş geldiniz, ${data.user.fullName}.`,
      });
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Kayıt başarısız',
        message: getApiErrorMessage(error),
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    registerMutation.mutate(values);
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

        <h1 className={styles.title}>Hesabınızı oluşturun</h1>
        <p className={styles.subtitle}>
          Çalışma alanınızı oluşturun ve ekibinizi davet edin.
        </p>

        <form onSubmit={onSubmit}>
          <div className={styles.formStack}>
            <TextInput
              label="Ad Soyad"
              placeholder="Ad Soyad"
              classNames={fieldClassNames}
              {...form.register('fullName')}
              error={form.formState.errors.fullName?.message}
            />

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
              classNames={passwordClassNames}
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />

            <PasswordInput
              label="Şifre Tekrar"
              placeholder="••••••••"
              classNames={passwordClassNames}
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
            />

            <Button
              className={styles.submitBtn}
              fullWidth
              type="submit"
              loading={registerMutation.isPending}
            >
              Hesap Oluştur
            </Button>
          </div>
        </form>

        <p className={styles.footer}>
          Zaten hesabınız var mı?{' '}
          <Anchor component={Link} to="/login" className={styles.registerLink}>
            Giriş Yap
          </Anchor>
        </p>
      </div>
    </div>
  );
}
