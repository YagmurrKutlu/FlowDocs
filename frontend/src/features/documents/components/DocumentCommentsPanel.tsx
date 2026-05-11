import {
  Badge,
  Blockquote,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/errors';
import {
  FLOWDOCS_CAPTURE_COMMENT_SELECTION,
  FLOWDOCS_COMMENT_SELECTION_READY,
} from '../editor/comment-selection-events';
import {
  useCreateDocumentCommentMutation,
  useUpdateDocumentCommentMutation,
  useDeleteDocumentCommentMutation,
  useDocumentCommentsQuery,
  useResolveDocumentCommentMutation,
} from '../hooks/useDocumentsQueries';
import type { DocumentComment } from '../types/document.types';

type CommentFilterTab = 'all' | 'active' | 'resolved';

const FILTER_LABELS: Record<CommentFilterTab, string> = {
  all: 'All',
  active: 'Active',
  resolved: 'Resolved',
};

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

export interface DocumentCommentsPanelProps {
  documentId: string;
  canRead: boolean;
  canEdit: boolean;
  currentUserId: string | undefined;
}

export function DocumentCommentsPanel({
  documentId,
  canRead,
  canEdit,
  currentUserId,
}: DocumentCommentsPanelProps) {
  const commentsQuery = useDocumentCommentsQuery(canRead ? documentId : undefined);
  const createMutation = useCreateDocumentCommentMutation(documentId);
  const updateMutation = useUpdateDocumentCommentMutation(documentId);
  const resolveMutation = useResolveDocumentCommentMutation(documentId);
  const deleteMutation = useDeleteDocumentCommentMutation(documentId);

  const [body, setBody] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [anchorInput, setAnchorInput] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [commentFilter, setCommentFilter] = useState<CommentFilterTab>('all');

  const allComments = commentsQuery.data?.comments ?? [];
  const filteredComments = useMemo(() => {
    switch (commentFilter) {
      case 'active':
        return allComments.filter((c) => !c.isResolved);
      case 'resolved':
        return allComments.filter((c) => c.isResolved);
      default:
        return allComments;
    }
  }, [allComments, commentFilter]);

  const showNoCommentsYet =
    commentsQuery.isSuccess && commentFilter === 'all' && allComments.length === 0;

  const showEmptyCategory =
    commentsQuery.isSuccess &&
    ((commentFilter !== 'all' && allComments.length === 0) ||
      (allComments.length > 0 && filteredComments.length === 0));

  useEffect(() => {
    const onReady = (e: Event) => {
      const ce = e as CustomEvent<{
        documentId: string;
        hadRange?: boolean;
        anchorOffset?: number;
        focusOffset?: number;
        selectedText: string;
      }>;
      if (ce.detail?.documentId !== documentId) return;
      if (!ce.detail.hadRange) return;
      setSelectedText(ce.detail.selectedText ?? '');
      if (typeof ce.detail.anchorOffset === 'number') {
        setAnchorInput(String(ce.detail.anchorOffset));
      }
      if (typeof ce.detail.focusOffset === 'number') {
        setFocusInput(String(ce.detail.focusOffset));
      }
    };
    window.addEventListener(FLOWDOCS_COMMENT_SELECTION_READY, onReady);
    return () => window.removeEventListener(FLOWDOCS_COMMENT_SELECTION_READY, onReady);
  }, [documentId]);

  const parseOptionalInt = (value: string): number | undefined => {
    const t = value.trim();
    if (!t) return undefined;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const handleAddComment = () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    const anchorOffset = parseOptionalInt(anchorInput);
    const focusOffset = parseOptionalInt(focusInput);
    const st = selectedText.trim();

    void createMutation.mutate(
      {
        body: trimmed,
        ...(st ? { selectedText: st } : {}),
        ...(anchorOffset !== undefined ? { anchorOffset } : {}),
        ...(focusOffset !== undefined ? { focusOffset } : {}),
      },
      {
        onSuccess: () => {
          setBody('');
          setSelectedText('');
          setAnchorInput('');
          setFocusInput('');
          notifications.show({
            title: 'Comment added',
            message: 'Your comment was posted.',
            color: 'teal',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Could not add comment',
            message: getApiErrorMessage(err),
            color: 'red',
          });
        },
      },
    );
  };

  const handleResolve = (comment: DocumentComment) => {
    void resolveMutation.mutate(comment.id, {
      onError: (err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        notifications.show({
          title: status === 403 ? 'Not allowed' : 'Could not resolve',
          message: getApiErrorMessage(err),
          color: status === 403 ? 'orange' : 'red',
        });
      },
    });
  };

  const canShowResolve = (comment: DocumentComment) =>
    !comment.isResolved && (canEdit || comment.author.id === currentUserId);

  const canShowDelete = (comment: DocumentComment) =>
    canEdit || comment.author.id === currentUserId;

  const canShowEdit = (comment: DocumentComment) =>
    canEdit || comment.author.id === currentUserId;

  const handleStartEdit = (comment: DocumentComment) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingBody('');
  };

  const handleSaveEdit = (comment: DocumentComment) => {
    const trimmed = editingBody.trim();
    if (!trimmed) return;

    void updateMutation.mutate(
      {
        commentId: comment.id,
        payload: { body: trimmed },
      },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          setEditingBody('');
          notifications.show({
            title: 'Yorum güncellendi',
            message: 'Yorum metni kaydedildi.',
            color: 'teal',
          });
        },
        onError: (err) => {
          const status = axios.isAxiosError(err) ? err.response?.status : undefined;
          notifications.show({
            title: status === 403 ? 'İzin yok' : 'Güncellenemedi',
            message: getApiErrorMessage(err),
            color: status === 403 ? 'orange' : 'red',
          });
        },
      },
    );
  };

  const handleDelete = (comment: DocumentComment) => {
    if (!window.confirm('Bu yorumu silmek istediğine emin misin?')) return;
    void deleteMutation.mutate(comment.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Yorum silindi',
          message: 'Yorum kaldırıldı.',
          color: 'teal',
        });
      },
      onError: (err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        notifications.show({
          title: status === 403 ? 'İzin yok' : 'Silinemedi',
          message: getApiErrorMessage(err),
          color: status === 403 ? 'orange' : 'red',
        });
      },
    });
  };

  return (
    <Stack gap="md">
      <Title order={4}>Comments</Title>

      {!canRead ? (
        <Text size="sm" c="dimmed">
          You do not have access to comments on this document.
        </Text>
      ) : null}

      {canRead ? (
        <>
          <Stack gap="xs">
            <Textarea
              label="New comment"
              placeholder="Write a comment…"
              minRows={3}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
            <TextInput
              label="Selected text (optional)"
              placeholder="Quote or excerpt"
              value={selectedText}
              onChange={(e) => setSelectedText(e.currentTarget.value)}
            />
            <Group gap="xs" align="flex-end" wrap="wrap">
              <Button
                type="button"
                variant="light"
                size="xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent(FLOWDOCS_CAPTURE_COMMENT_SELECTION, {
                      detail: { documentId },
                    }),
                  );
                }}
              >
                Use current selection
              </Button>
              <Text size="xs" c="dimmed" maw={280}>
                Select text in the editor first, then click here (selection is kept on
                mousedown).
              </Text>
            </Group>
            <Group grow>
              <TextInput
                label="Anchor offset (optional)"
                placeholder="e.g. 12"
                value={anchorInput}
                onChange={(e) => setAnchorInput(e.currentTarget.value)}
              />
              <TextInput
                label="Focus offset (optional)"
                placeholder="e.g. 20"
                value={focusInput}
                onChange={(e) => setFocusInput(e.currentTarget.value)}
              />
            </Group>
            <Button
              onClick={handleAddComment}
              loading={createMutation.isPending}
              disabled={!body.trim()}
            >
              Add comment
            </Button>
          </Stack>

          {commentsQuery.isLoading ? (
            <Text size="sm" c="dimmed">
              Loading comments…
            </Text>
          ) : null}

          {commentsQuery.isError ? (
            <Text size="sm" c="red">
              {getApiErrorMessage(commentsQuery.error)}
            </Text>
          ) : null}

          {commentsQuery.isSuccess && allComments.length > 0 ? (
            <Group gap={4} wrap="nowrap" role="tablist" aria-label="Comment filters">
              {(
                [
                  ['all', FILTER_LABELS.all],
                  ['active', FILTER_LABELS.active],
                  ['resolved', FILTER_LABELS.resolved],
                ] as const
              ).map(([value, label]) => {
                const selected = commentFilter === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={selected ? 'light' : 'subtle'}
                    size="compact-xs"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setCommentFilter(value)}
                    styles={{
                      root: {
                        fontWeight: selected ? 600 : 400,
                        borderBottom: selected
                          ? '2px solid var(--mantine-primary-color-filled)'
                          : '2px solid transparent',
                        borderRadius: 'var(--mantine-radius-sm) var(--mantine-radius-sm) 0 0',
                      },
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </Group>
          ) : null}

          {showNoCommentsYet ? (
            <Text size="sm" c="dimmed">
              No comments yet.
            </Text>
          ) : null}

          {showEmptyCategory ? (
            <Text size="sm" c="dimmed">
              Bu kategoride yorum yok.
            </Text>
          ) : null}

          {commentsQuery.isSuccess && filteredComments.length > 0 ? (
            <Stack gap="md">
              {filteredComments.map((comment) => (
                <Stack
                  key={comment.id}
                  gap={6}
                  p="sm"
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--mantine-color-dark-4)',
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={600}>
                        {comment.author.fullName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {comment.author.email}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      {comment.isResolved ? (
                        <Badge color="gray" variant="light" size="sm">
                          Resolved
                        </Badge>
                      ) : null}
                      {canShowResolve(comment) ? (
                        <Button
                          size="xs"
                          variant="light"
                          loading={resolveMutation.isPending}
                          disabled={
                            deleteMutation.isPending ||
                            resolveMutation.isPending ||
                            updateMutation.isPending
                          }
                          onClick={() => handleResolve(comment)}
                        >
                          Resolve
                        </Button>
                      ) : null}
                      {canShowDelete(comment) ? (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          loading={
                            deleteMutation.isPending &&
                            deleteMutation.variables === comment.id
                          }
                          disabled={
                            deleteMutation.isPending ||
                            resolveMutation.isPending ||
                            updateMutation.isPending
                          }
                          onClick={() => handleDelete(comment)}
                        >
                          Sil
                        </Button>
                      ) : null}
                      {canShowEdit(comment) ? (
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconPencil size={14} />}
                          disabled={
                            deleteMutation.isPending ||
                            resolveMutation.isPending ||
                            updateMutation.isPending
                          }
                          onClick={() => handleStartEdit(comment)}
                        >
                          Duzenle
                        </Button>
                      ) : null}
                    </Group>
                  </Group>

                  {comment.selectedText ? (
                    <Blockquote cite={comment.author.fullName} p="xs" fz="sm">
                      {comment.selectedText}
                    </Blockquote>
                  ) : null}

                  {comment.anchorOffset != null && comment.focusOffset != null ? (
                    <Text size="xs" c="dimmed" ff="monospace">
                      Selection: {comment.anchorOffset} → {comment.focusOffset}
                    </Text>
                  ) : null}

                  {editingCommentId === comment.id ? (
                    <Stack gap="xs">
                      <Textarea
                        value={editingBody}
                        minRows={3}
                        onChange={(e) => setEditingBody(e.currentTarget.value)}
                        disabled={updateMutation.isPending}
                      />
                      <Group gap="xs">
                        <Button
                          size="xs"
                          onClick={() => handleSaveEdit(comment)}
                          loading={
                            updateMutation.isPending &&
                            updateMutation.variables?.commentId === comment.id
                          }
                          disabled={
                            updateMutation.isPending ||
                            !editingBody.trim() ||
                            deleteMutation.isPending ||
                            resolveMutation.isPending
                          }
                        >
                          Kaydet
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          onClick={handleCancelEdit}
                          disabled={updateMutation.isPending}
                        >
                          Vazgec
                        </Button>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm">{comment.body}</Text>
                  )}

                  <Text size="xs" c="dimmed">
                    {formatDate(comment.createdAt)}
                    {comment.resolvedAt && comment.resolvedBy
                      ? ` · Resolved by ${comment.resolvedBy.fullName}`
                      : ''}
                  </Text>
                </Stack>
              ))}
            </Stack>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
