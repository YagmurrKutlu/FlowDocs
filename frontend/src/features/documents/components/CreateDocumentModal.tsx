import {
  Button,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '../../../shared/api/client';
import type { WorkspaceListResponse } from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useCreateDocumentMutation } from '../hooks/useDocumentsQueries';

const schema = z.object({
  workspaceId: z.string().min(1, 'Çalışma alanı seçin.'),
  title: z.string().trim().min(2, 'Başlık en az 2 karakter olmalıdır.'),
});

type FormValues = z.infer<typeof schema>;

interface CreateDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (documentId: string) => void;
}

export function CreateDocumentModal({
  opened,
  onClose,
  onCreated,
}: CreateDocumentModalProps) {
  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkspaceListResponse>('/workspaces');
      return data;
    },
    enabled: opened,
  });

  const createMutation = useCreateDocumentMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      workspaceId: '',
      title: '',
    },
  });

  const workspaces = useMemo(
    () => workspacesQuery.data?.workspaces ?? [],
    [workspacesQuery.data],
  );

  const workspaceId = useWatch({
    control: form.control,
    name: 'workspaceId',
  });

  useEffect(() => {
    if (!opened) {
      form.reset({ workspaceId: '', title: '' });
      return;
    }
    if (workspaces.length === 1 && !form.getValues('workspaceId')) {
      form.setValue('workspaceId', workspaces[0].id);
    }
  }, [opened, workspaces, form]);

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(
      { workspaceId: values.workspaceId, title: values.title },
      {
        onSuccess: (data) => {
          notifications.show({
            color: 'teal',
            title: 'Doküman oluşturuldu',
            message: `"${data.document.title}" hazır.`,
          });
          onCreated(data.document.id);
          onClose();
        },
        onError: (error) => {
          notifications.show({
            color: 'red',
            title: 'Doküman oluşturulamadı',
            message: getApiErrorMessage(error),
          });
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit}>
      <Stack>
        {workspacesQuery.isLoading ? (
          <TextInput label="Çalışma Alanı" disabled placeholder="Çalışma alanları yükleniyor…" />
        ) : workspacesQuery.isError ? (
          <TextInput
            label="Çalışma Alanı"
            disabled
            description={getApiErrorMessage(workspacesQuery.error)}
            placeholder="Çalışma alanları yüklenemedi"
          />
        ) : workspaces.length === 0 ? (
          <TextInput
            label="Çalışma Alanı"
            disabled
            description="Önce bir çalışma alanı oluşturun."
            placeholder="Çalışma alanı yok"
          />
        ) : (
          <Select
            label="Çalışma Alanı"
            placeholder="Çalışma alanı seç"
            data={workspaces.map((w) => ({
              value: w.id,
              label: `${w.name} (${w.slug})`,
            }))}
            value={workspaceId || null}
            onChange={(value) =>
              form.setValue('workspaceId', value ?? '', { shouldValidate: true })
            }
            error={form.formState.errors.workspaceId?.message}
            searchable
            nothingFoundMessage="Çalışma alanı bulunamadı"
          />
        )}

        <TextInput
          label="Başlık"
          placeholder="Ürün özeti, toplantı notları…"
          {...form.register('title')}
          error={form.formState.errors.title?.message}
        />

        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={workspaces.length === 0}
        >
          Doküman oluştur
        </Button>
      </Stack>
    </form>
  );
}
