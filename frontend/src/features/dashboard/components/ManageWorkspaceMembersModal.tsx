import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '../../../shared/api/client';
import type {
  AddWorkspaceMemberPayload,
  AddWorkspaceMemberResponse,
  WorkspaceMembersResponse,
} from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';

const addMemberSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export interface ManageWorkspaceMembersModalProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string | null;
  workspaceName: string;
  canManageMembers: boolean;
}

export function ManageWorkspaceMembersModal({
  opened,
  onClose,
  workspaceId,
  workspaceName,
  canManageMembers,
}: ManageWorkspaceMembersModalProps) {
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkspaceMembersResponse>(
        `/workspaces/${workspaceId}/members`,
      );
      return data;
    },
    enabled: opened && Boolean(workspaceId),
  });

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      role: 'EDITOR',
    },
  });

  useEffect(() => {
    if (!opened) {
      form.reset({ email: '', role: 'EDITOR' });
    }
  }, [opened, form]);

  const addMemberMutation = useMutation({
    mutationFn: async (payload: AddWorkspaceMemberPayload) => {
      const { data } = await apiClient.post<AddWorkspaceMemberResponse>(
        `/workspaces/${workspaceId}/members`,
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      notifications.show({
        color: 'teal',
        title: 'Member added',
        message: `${data.membership.fullName} joined as ${data.membership.role}.`,
      });
      void queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      form.reset({ email: '', role: 'EDITOR' });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Could not add member',
        message: getApiErrorMessage(error),
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!workspaceId) return;
    addMemberMutation.mutate({
      email: values.email.trim().toLowerCase(),
      role: values.role,
    });
  });

  const members = membersQuery.data?.members ?? [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Members — ${workspaceName}`}
      centered
      size="lg"
    >
      <Stack gap="md">
        {membersQuery.isLoading ? (
          <Text size="sm" c="dimmed">
            Loading members…
          </Text>
        ) : null}

        {membersQuery.isError ? (
          <Text size="sm" c="red">
            {getApiErrorMessage(membersQuery.error)}
          </Text>
        ) : null}

        {membersQuery.isSuccess ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Joined</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed">
                      No members yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                members.map((m) => (
                  <Table.Tr key={m.userId}>
                    <Table.Td>{m.fullName}</Table.Td>
                    <Table.Td>{m.email}</Table.Td>
                    <Table.Td>{m.role}</Table.Td>
                    <Table.Td>
                      {new Date(m.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        ) : null}

        {canManageMembers ? (
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <Text fw={600} size="sm">
                Add member
              </Text>
              <TextInput
                label="Email"
                placeholder="colleague@example.com"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />
              <Select
                label="Role"
                data={[
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'EDITOR', label: 'Editor' },
                  { value: 'VIEWER', label: 'Viewer' },
                ]}
                value={form.watch('role')}
                onChange={(value) =>
                  form.setValue('role', (value ?? 'EDITOR') as AddMemberFormValues['role'], {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.role?.message}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={addMemberMutation.isPending}
                  disabled={!workspaceId}
                >
                  Add member
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Text size="sm" c="dimmed">
            Only workspace owners and admins can invite new members.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
