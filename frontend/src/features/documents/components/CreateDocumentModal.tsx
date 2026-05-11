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
  workspaceId: z.string().min(1, 'Select a workspace.'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters.'),
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
            title: 'Document created',
            message: `"${data.document.title}" is ready.`,
          });
          onCreated(data.document.id);
          onClose();
        },
        onError: (error) => {
          notifications.show({
            color: 'red',
            title: 'Could not create document',
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
          <TextInput label="Workspace" disabled placeholder="Loading workspaces…" />
        ) : workspacesQuery.isError ? (
          <TextInput
            label="Workspace"
            disabled
            description={getApiErrorMessage(workspacesQuery.error)}
            placeholder="Failed to load workspaces"
          />
        ) : workspaces.length === 0 ? (
          <TextInput
            label="Workspace"
            disabled
            description="Create a workspace from the dashboard first."
            placeholder="No workspaces"
          />
        ) : (
          <Select
            label="Workspace"
            placeholder="Choose workspace"
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
            nothingFoundMessage="No workspace"
          />
        )}

        <TextInput
          label="Title"
          placeholder="Product brief, meeting notes…"
          {...form.register('title')}
          error={form.formState.errors.title?.message}
        />

        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={workspaces.length === 0}
        >
          Create document
        </Button>
      </Stack>
    </form>
  );
}
