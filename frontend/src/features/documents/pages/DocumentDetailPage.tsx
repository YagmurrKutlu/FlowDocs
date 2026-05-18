import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
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
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageContainer } from '../../../components/ui/PageContainer';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import { DocumentInTrashView } from '../components/DocumentInTrashView';
import { DocumentCommentsPanel } from '../components/DocumentCommentsPanel';
import { DocumentMessagesPanel } from '../components/DocumentMessagesPanel';
import { DocumentEditorShell } from '../editor/DocumentEditorShell';
import {
  useAddDocumentMemberMutation,
  useDocumentDetailQuery,
  useDocumentMembersQuery,
  useRemoveDocumentMemberMutation,
  useUpdateDocumentMemberRoleMutation,
} from '../hooks/useDocumentsQueries';
import type { DocumentMemberRow } from '../types/document.types';
import docPageStyles from './DocumentDetailPage.module.css';

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
  const isInTrash = status === 410;
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

  const shareModal = (
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
  );

  if (detailQuery.isLoading) {
    return (
      <PageContainer>
        <Stack gap="md">
          <Skeleton h={36} w="60%" radius="md" />
          <Skeleton h={24} w="40%" radius="md" />
          <Skeleton h={200} radius="lg" />
        </Stack>
      </PageContainer>
    );
  }

  if (detailQuery.isError) {
    if (isInTrash) {
      return (
        <PageContainer>
          <DocumentInTrashView />
        </PageContainer>
      );
    }

    return (
      <PageContainer>
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
              Dokümanlara Dön
            </Button>
          </Stack>
        </Alert>
      </PageContainer>
    );
  }

  if (detailQuery.isSuccess && detailQuery.data && id) {
    return (
      <>
        <Box className={docPageStyles.pageRoot}>
          <Box className={docPageStyles.editorPage}>
            <Box className={docPageStyles.editorShellHost}>
              <DocumentEditorShell
                documentId={id}
                canEdit={canEdit}
                initialContent={detailQuery.data.document.previewContent}
                documentTitle={detailQuery.data.document.title}
                onShareClick={() => setShareModalOpen(true)}
                shareDisabled={!detailQuery.isSuccess}
                memberAvatars={membersQuery.data?.members.map((m) => ({
                  userId: m.userId,
                  fullName: m.fullName,
                  avatarUrl: m.avatarUrl,
                }))}
                commentsPanel={
                  <DocumentCommentsPanel
                    documentId={id}
                    canRead={canRead}
                    canEdit={canEdit}
                    currentUserId={authUser?.id}
                  />
                }
                messagesPanel={
                  <DocumentMessagesPanel
                    documentId={id}
                    canRead={canRead}
                    currentUserId={authUser?.id}
                  />
                }
              />
            </Box>
          </Box>
          {detailQuery.isFetching ? (
            <Group className={docPageStyles.fetchingOverlay} gap="xs">
              <Loader size="sm" color="violet" />
              <Text size="sm" c="dimmed">
                Updating…
              </Text>
            </Group>
          ) : null}
        </Box>
        {shareModal}
      </>
    );
  }

  return null;
}
