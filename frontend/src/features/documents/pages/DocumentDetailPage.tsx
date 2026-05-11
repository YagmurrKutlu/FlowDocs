import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppCard } from '../../../components/ui/AppCard';
import { PageContainer } from '../../../components/ui/PageContainer';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import { DocumentCommentsPanel } from '../components/DocumentCommentsPanel';
import { DocumentEditorShell } from '../editor/DocumentEditorShell';
import {
  useAddDocumentMemberMutation,
  useDocumentDetailQuery,
  useDocumentMembersQuery,
  useRemoveDocumentMemberMutation,
  useUpdateDocumentMemberRoleMutation,
} from '../hooks/useDocumentsQueries';
import type { DocumentMemberRow } from '../types/document.types';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const detailQuery = useDocumentDetailQuery(id);
  const membersQuery = useDocumentMembersQuery(id);
  const addMemberMutation = useAddDocumentMemberMutation(id ?? '');
  const updateMemberRoleMutation = useUpdateDocumentMemberRoleMutation(id ?? '');
  const removeMemberMutation = useRemoveDocumentMemberMutation(id ?? '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const status = axios.isAxiosError(detailQuery.error)
    ? detailQuery.error.response?.status
    : undefined;

  const isForbidden = status === 403;
  const isNotFound = status === 404;
  const canShare = Boolean(detailQuery.data?.document.permissions.canShare);
  const canEdit = Boolean(detailQuery.data?.document.permissions.canEdit);
  const canRead = Boolean(detailQuery.data?.document.permissions.canRead);
  const currentUserId = authUser?.id;

  const handleAddMember = () => {
    if (!id) return;
    void addMemberMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
        },
      },
    );
  };

  const roleBadgeColor = (memberRole: DocumentMemberRow['role']) => {
    if (memberRole === 'OWNER') return 'violet';
    if (memberRole === 'EDITOR') return 'blue';
    return 'gray';
  };

  const handleUpdateRole = (member: DocumentMemberRow, nextRole: string | null) => {
    if (!id || !nextRole) return;
    if (member.role === 'OWNER') return;

    void updateMemberRoleMutation.mutate({
      memberId: member.id,
      payload: { role: nextRole as 'EDITOR' | 'VIEWER' },
    });
  };

  const handleRemoveMember = (member: DocumentMemberRow) => {
    if (!id) return;
    if (member.role === 'OWNER') return;
    if (!window.confirm(`${member.fullName} kullanicisini dokumandan kaldiralim mi?`)) {
      return;
    }
    void removeMemberMutation.mutate(member.id);
  };

  return (
    <PageContainer>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={() => navigate('/documents')}>
            ← Back to documents
          </Button>
          <Button
            variant="light"
            onClick={() => setShareModalOpen(true)}
            disabled={!detailQuery.isSuccess}
          >
            Share
          </Button>
        </Group>

        {detailQuery.isLoading ? (
          <Stack gap="md">
            <Skeleton h={36} w="60%" radius="md" />
            <Skeleton h={24} w="40%" radius="md" />
            <Skeleton h={200} radius="lg" />
          </Stack>
        ) : null}

        {detailQuery.isError ? (
          <Alert
            color={isForbidden ? 'orange' : isNotFound ? 'gray' : 'red'}
            title={
              isForbidden
                ? 'Access denied'
                : isNotFound
                  ? 'Document not found'
                  : 'Something went wrong'
            }
            radius="md"
          >
            <Stack gap="sm">
              <Text size="sm">{getApiErrorMessage(detailQuery.error)}</Text>
              <Button variant="light" onClick={() => navigate('/documents')}>
                Return to documents
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {detailQuery.isSuccess && detailQuery.data ? (
          <>
            <Stack gap={4}>
              <Title order={2}>{detailQuery.data.document.title}</Title>
              <Text c="dimmed" ff="monospace" size="sm">
                {detailQuery.data.document.slug}
              </Text>
              <Group gap="xs" mt="xs">
                <Badge color="violet" variant="light">
                  Version {detailQuery.data.document.currentVersion}
                </Badge>
                <Text size="sm" c="dimmed">
                  Created {formatDate(detailQuery.data.document.createdAt)}
                </Text>
                <Text size="sm" c="dimmed">
                  · Updated {formatDate(detailQuery.data.document.updatedAt)}
                </Text>
              </Group>
            </Stack>

            <AppCard p="xl" radius="lg">
              <Stack gap="md">
                <Title order={4}>Editor</Title>
                <Text c="dimmed" size="sm">
                  Yjs durumu sunucuda saklanır; bu görünüm çoklu kullanıcı senkronu için
                  temel Lexical + kalıcılık iskeletidir.
                </Text>
                {id ? (
                  <DocumentEditorShell
                    documentId={id}
                    canEdit={canEdit}
                    initialContent={detailQuery.data.document.previewContent}
                  />
                ) : null}
              </Stack>
            </AppCard>

            {id ? (
              <AppCard p="lg" radius="lg">
                <DocumentCommentsPanel
                  documentId={id}
                  canRead={canRead}
                  canEdit={canEdit}
                  currentUserId={authUser?.id}
                />
              </AppCard>
            ) : null}

            <AppCard p="lg" radius="lg">
              <Group justify="space-between" align="center">
                <div>
                  <Title order={4}>Sharing</Title>
                  <Text size="sm" c="dimmed">
                    Current role: {detailQuery.data.document.currentUserRole ?? 'N/A'}
                  </Text>
                </div>
                <Button
                  variant="light"
                  onClick={() => setShareModalOpen(true)}
                  disabled={!canRead}
                >
                  Manage members
                </Button>
              </Group>
            </AppCard>
          </>
        ) : null}

        {detailQuery.isFetching && !detailQuery.isLoading ? (
          <Group>
            <Loader size="sm" color="violet" />
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          </Group>
        ) : null}
      </Stack>

      <Modal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share document"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Your role: {detailQuery.data?.document.currentUserRole ?? 'N/A'}
          </Text>

          {canShare ? (
            <Group align="end">
              <TextInput
                label="Member email"
                placeholder="user@example.com"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Select
                label="Role"
                data={[
                  { value: 'EDITOR', label: 'Editor' },
                  { value: 'VIEWER', label: 'Viewer' },
                ]}
                value={role}
                onChange={(value) => setRole((value as 'EDITOR' | 'VIEWER') ?? 'EDITOR')}
                w={150}
              />
              <Button
                onClick={handleAddMember}
                loading={addMemberMutation.isPending}
                disabled={!email.trim()}
              >
                Invite
              </Button>
            </Group>
          ) : (
            <Alert color="gray" title="View only">
              You can see members, but only owners/admins can change sharing settings.
            </Alert>
          )}

          {addMemberMutation.isError ? (
            <Alert color="red" title="Could not add member">
              {getApiErrorMessage(addMemberMutation.error)}
            </Alert>
          ) : null}

          {updateMemberRoleMutation.isError ? (
            <Alert color="red" title="Could not update role">
              {getApiErrorMessage(updateMemberRoleMutation.error)}
            </Alert>
          ) : null}

          {removeMemberMutation.isError ? (
            <Alert color="red" title="Could not remove member">
              {getApiErrorMessage(removeMemberMutation.error)}
            </Alert>
          ) : null}

          {membersQuery.isLoading ? (
            <Text c="dimmed" size="sm">
              Loading members...
            </Text>
          ) : null}

          {membersQuery.isSuccess && membersQuery.data.members.length === 0 ? (
            <Text c="dimmed" size="sm">
              No members listed.
            </Text>
          ) : null}

          {membersQuery.isSuccess && membersQuery.data.members.length > 0 ? (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Joined</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {membersQuery.data.members.map((m) => {
                  const isSelf = m.userId === currentUserId;
                  const roleLabel =
                    m.role === 'OWNER' ? 'Owner' : m.role === 'EDITOR' ? 'Editor' : 'Viewer';
                  const canManageMember = canShare && m.role !== 'OWNER';

                  return (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar src={m.avatarUrl ?? undefined} radius="xl" size="sm">
                            {m.fullName.slice(0, 1)}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {m.fullName} {isSelf ? '(you)' : ''}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {m.email}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Badge variant="light" color={roleBadgeColor(m.role)}>
                            {roleLabel}
                          </Badge>
                          <Select
                            size="xs"
                            data={[
                              { value: 'EDITOR', label: 'Editor' },
                              { value: 'VIEWER', label: 'Viewer' },
                            ]}
                            value={m.role === 'OWNER' ? null : m.role}
                            placeholder={m.role === 'OWNER' ? 'Owner' : 'Set role'}
                            disabled={
                              !canManageMember ||
                              updateMemberRoleMutation.isPending ||
                              removeMemberMutation.isPending
                            }
                            onChange={(value) => handleUpdateRole(m, value)}
                          />
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {formatDate(m.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          disabled={
                            !canManageMember ||
                            updateMemberRoleMutation.isPending ||
                            removeMemberMutation.isPending
                          }
                          loading={
                            removeMemberMutation.isPending &&
                            removeMemberMutation.variables === m.id
                          }
                          onClick={() => handleRemoveMember(m)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          ) : null}
        </Stack>
      </Modal>
    </PageContainer>
  );
}
