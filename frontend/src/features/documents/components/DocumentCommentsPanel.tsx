import {
  Avatar,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
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
import classes from './DocumentCommentsPanel.module.css';

type CommentFilterTab = 'all' | 'active' | 'resolved';

const FILTER_LABELS: Record<CommentFilterTab, string> = {
  all: 'Tümü',
  active: 'Açık',
  resolved: 'Çözüldü',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatCommentClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatResolvedDetail(comment: DocumentComment): string {
  if (!comment.resolvedAt || !comment.resolvedBy) return '';
  try {
    const t = new Date(comment.resolvedAt).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${comment.resolvedBy.fullName} · ${t}`;
  } catch {
    return comment.resolvedBy.fullName;
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
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);

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

  const busy =
    deleteMutation.isPending || resolveMutation.isPending || updateMutation.isPending;

  return (
    <Stack gap={0} className={classes.root}>
      <Text component="h2" className={classes.sectionTitle}>
        YORUMLAR
      </Text>

      {!canRead ? (
        <Text size="sm" className={classes.mutedText}>
          Bu dokümanda yorumları görüntüleme iznin yok.
        </Text>
      ) : null}

      {canRead ? (
        <>
          <Box className={classes.formSection}>
            <Text className={classes.formTitle}>Yeni yorum</Text>
            <Stack gap="sm">
              <Textarea
                label="Yorum"
                placeholder="Yorum yaz..."
                minRows={3}
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                classNames={{ label: classes.formLabel, input: classes.formTextarea }}
              />
              <TextInput
                label="Seçili metin (isteğe bağlı)"
                placeholder="Alıntı veya özet"
                value={selectedText}
                onChange={(e) => setSelectedText(e.currentTarget.value)}
                classNames={{ label: classes.formLabel, input: classes.formQuoteInput }}
              />
              <Group gap="sm" align="flex-start" wrap="wrap">
                <Button
                  type="button"
                  variant="light"
                  size="xs"
                  classNames={{ root: classes.captureBtnRoot }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent(FLOWDOCS_CAPTURE_COMMENT_SELECTION, {
                        detail: { documentId },
                      }),
                    );
                  }}
                >
                  Seçimi kullan
                </Button>
                <Text className={classes.selectionHint}>
                  Önce editörde metin seç; ardından buraya tıkla (fare tuşu basılıyken seçim
                  korunur).
                </Text>
              </Group>

              <details className={classes.advancedDetails}>
                <summary className={classes.advancedSummary}>Gelişmiş · bağlantı offset</summary>
                <Box className={classes.advancedBody}>
                  <Group grow gap="sm">
                    <TextInput
                      label="Anchor offset"
                      placeholder="örn. 12"
                      value={anchorInput}
                      onChange={(e) => setAnchorInput(e.currentTarget.value)}
                      classNames={{ label: classes.formLabel, input: classes.advancedInput }}
                    />
                    <TextInput
                      label="Focus offset"
                      placeholder="örn. 20"
                      value={focusInput}
                      onChange={(e) => setFocusInput(e.currentTarget.value)}
                      classNames={{ label: classes.formLabel, input: classes.advancedInput }}
                    />
                  </Group>
                </Box>
              </details>

              <Button
                onClick={handleAddComment}
                loading={createMutation.isPending}
                disabled={!body.trim()}
                classNames={{ root: classes.addBtnRoot }}
              >
                Yorum ekle
              </Button>
            </Stack>
          </Box>

          {commentsQuery.isLoading ? (
            <Text size="sm" className={classes.mutedText}>
              Yorumlar yükleniyor…
            </Text>
          ) : null}

          {commentsQuery.isError ? (
            <Text size="sm" c="red">
              {getApiErrorMessage(commentsQuery.error)}
            </Text>
          ) : null}

          {commentsQuery.isSuccess && allComments.length > 0 ? (
            <Group gap={4} wrap="wrap" role="tablist" aria-label="Yorum filtreleri" className={classes.filterRow}>
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
                    variant="subtle"
                    size="compact-sm"
                    role="tab"
                    aria-selected={selected}
                    classNames={{
                      root: selected ? classes.filterRootActive : classes.filterRoot,
                    }}
                    onClick={() => setCommentFilter(value)}
                  >
                    {label}
                  </Button>
                );
              })}
            </Group>
          ) : null}

          {showNoCommentsYet ? (
            <Stack gap={6} mb="md">
              <Text className={classes.emptyTitle}>Henüz yorum yok</Text>
              <Text className={classes.mutedText}>Metin seçip yeni yorum ekleyebilirsin.</Text>
            </Stack>
          ) : null}

          {showEmptyCategory ? (
            <Text size="sm" className={classes.mutedText} mb="md">
              Bu kategoride yorum yok.
            </Text>
          ) : null}

          {commentsQuery.isSuccess && filteredComments.length > 0 ? (
            <Box className={classes.list}>
              {filteredComments.map((comment) => {
                const isActive =
                  editingCommentId === comment.id || hoveredCommentId === comment.id;
                return (
                  <Box
                    key={comment.id}
                    className={`${classes.commentCard}${isActive ? ` ${classes.commentCardActive}` : ''}`}
                    data-comment-id={comment.id}
                    data-flowdocs-comment-id={comment.id}
                    onMouseEnter={() => setHoveredCommentId(comment.id)}
                    onMouseLeave={() => setHoveredCommentId(null)}
                  >
                    {comment.selectedText ? (
                      <Box className={classes.quoteBand}>
                        <Text component="p" className={classes.quoteText}>
                          &ldquo;{comment.selectedText}&rdquo;
                        </Text>
                      </Box>
                    ) : null}

                    <Box className={classes.cardBody}>
                      <Box className={classes.authorRow}>
                        <Avatar
                          src={comment.author.avatarUrl ?? undefined}
                          radius="xl"
                          size={28}
                          color="violet"
                        >
                          {initialsFromName(comment.author.fullName)}
                        </Avatar>
                        <Text className={classes.authorName}>{comment.author.fullName}</Text>
                        <Text className={classes.time}>{formatCommentClock(comment.createdAt)}</Text>
                      </Box>

                      {editingCommentId === comment.id ? (
                        <Stack gap="xs">
                          <Textarea
                            value={editingBody}
                            minRows={3}
                            onChange={(e) => setEditingBody(e.currentTarget.value)}
                            disabled={updateMutation.isPending}
                            classNames={{ input: classes.editTextarea }}
                          />
                          <Group gap="xs" className={classes.editActions}>
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
                              Vazgeç
                            </Button>
                          </Group>
                        </Stack>
                      ) : (
                        <Text className={classes.commentBody}>{comment.body}</Text>
                      )}

                      {comment.isResolved && (comment.resolvedAt || comment.resolvedBy) ? (
                        <Text className={classes.metaLine}>{formatResolvedDetail(comment)}</Text>
                      ) : null}

                      {editingCommentId !== comment.id &&
                      comment.anchorOffset != null &&
                      comment.focusOffset != null ? (
                        <details className={classes.advancedDetails}>
                          <summary className={classes.advancedSummary}>Konum bilgisi</summary>
                          <Box className={classes.advancedBody}>
                            <Text size="xs" className={classes.mutedText} ff="monospace">
                              {comment.anchorOffset} → {comment.focusOffset}
                            </Text>
                          </Box>
                        </details>
                      ) : null}

                      <Box className={classes.actionsRow}>
                        <UnstyledButton type="button" className={classes.yanitlaBtn} disabled>
                          Yanıtla
                        </UnstyledButton>

                        {comment.isResolved ? (
                          <Text className={classes.resolveLabel}>
                            <IconCheck size={14} stroke={2.5} aria-hidden />
                            Çözüldü
                          </Text>
                        ) : canShowResolve(comment) ? (
                          <Button
                            type="button"
                            variant="transparent"
                            size="compact-xs"
                            leftSection={<IconCheck size={14} />}
                            classNames={{ root: classes.resolveBtn }}
                            loading={resolveMutation.isPending}
                            disabled={busy}
                            onClick={() => handleResolve(comment)}
                          >
                            Çöz
                          </Button>
                        ) : null}

                        {canShowEdit(comment) ? (
                          <Button
                            type="button"
                            variant="transparent"
                            size="compact-xs"
                            leftSection={<IconPencil size={14} />}
                            classNames={{ root: classes.editBtn }}
                            disabled={busy}
                            onClick={() => handleStartEdit(comment)}
                          >
                            Düzenle
                          </Button>
                        ) : null}

                        {canShowDelete(comment) ? (
                          <Button
                            type="button"
                            variant="transparent"
                            size="compact-xs"
                            leftSection={<IconTrash size={14} />}
                            classNames={{ root: classes.dangerBtn }}
                            loading={
                              deleteMutation.isPending && deleteMutation.variables === comment.id
                            }
                            disabled={busy}
                            onClick={() => handleDelete(comment)}
                          >
                            Sil
                          </Button>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
