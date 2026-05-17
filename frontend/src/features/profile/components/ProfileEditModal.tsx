import { Button, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ProfileUser } from '../types/profile.types';

const editSchema = z.object({
  displayName: z.string().trim().min(1, 'Görünen ad gerekli.').max(80),
  title: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(300).optional(),
  skillsText: z.string().trim().max(500).optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface ProfileEditModalProps {
  opened: boolean;
  onClose: () => void;
  user: ProfileUser;
  loading: boolean;
  onSubmit: (values: {
    displayName: string;
    title?: string;
    location?: string;
    bio?: string;
    skills?: string[];
  }) => void;
}

export function ProfileEditModal({
  opened,
  onClose,
  user,
  loading,
  onSubmit,
}: ProfileEditModalProps) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      displayName: user.displayName,
      title: user.title ?? '',
      location: user.location ?? '',
      bio: user.bio ?? '',
      skillsText: user.skills.join(', '),
    },
  });

  useEffect(() => {
    if (opened) {
      form.reset({
        displayName: user.displayName,
        title: user.title ?? '',
        location: user.location ?? '',
        bio: user.bio ?? '',
        skillsText: user.skills.join(', '),
      });
    }
  }, [form, opened, user]);

  const handleSubmit = form.handleSubmit((values) => {
    const skills = (values.skillsText ?? '')
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 12);

    onSubmit({
      displayName: values.displayName,
      title: values.title?.trim() || undefined,
      location: values.location?.trim() || undefined,
      bio: values.bio?.trim() || undefined,
      skills,
    });
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Profili Düzenle"
      centered
      size="md"
      styles={{
        content: {
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
        },
        header: { background: 'var(--modal-bg)' },
        title: { color: 'var(--modal-title)', fontWeight: 600 },
      }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Görünen ad"
            {...form.register('displayName')}
            error={form.formState.errors.displayName?.message}
            styles={{ label: { color: 'var(--modal-label)' } }}
          />
          <TextInput
            label="Ünvan"
            placeholder="Örn. Yazılım Mühendisliği Öğrencisi"
            {...form.register('title')}
            error={form.formState.errors.title?.message}
            styles={{ label: { color: 'var(--modal-label)' } }}
          />
          <TextInput
            label="Konum"
            placeholder="Aksaray, TR"
            {...form.register('location')}
            error={form.formState.errors.location?.message}
            styles={{ label: { color: 'var(--modal-label)' } }}
          />
          <Textarea
            label="Biyografi"
            minRows={3}
            {...form.register('bio')}
            error={form.formState.errors.bio?.message}
            styles={{ label: { color: 'var(--modal-label)' } }}
          />
          <TextInput
            label="Yetenekler"
            description="Virgülle ayırın (en fazla 12)"
            placeholder="React, NestJS, TypeScript"
            {...form.register('skillsText')}
            error={form.formState.errors.skillsText?.message}
            styles={{
              label: { color: 'var(--modal-label)' },
              description: { color: 'var(--modal-label)' },
            }}
          />
          <Button type="submit" loading={loading} color="violet">
            Kaydet
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
