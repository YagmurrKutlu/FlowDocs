import {
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSend, IconTrash } from '@tabler/icons-react';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useDocumentMessageTyping } from '../hooks/useDocumentMessageTyping';
import {
  useCreateDocumentMessageMutation,
  useDeleteDocumentMessageMutation,
  useDocumentMessagesQuery,
} from '../hooks/useDocumentsQueries';
import type { DocumentMessage } from '../types/document.types';
import { DOCUMENT_MESSAGE_MAX_LENGTH } from '../utils/document-messages-cache';
import {
  formatTypingIndicatorLabel,
  type DocumentMessageTypingUser,
} from '../utils/document-message-typing';
import classes from './DocumentMessagesPanel.module.css';

function formatMessageTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export interface DocumentMessagesPanelProps {
  documentId: string;
  canRead: boolean;
  currentUserId: string | undefined;
  activeUserIds?: ReadonlySet<string>;
  typingUsers?: ReadonlyArray<DocumentMessageTypingUser>;
  onEmitTyping?: (isTyping: boolean) => void;
}

function MessageBubble({
  message,
  isAuthorOnline,
  onDelete,
  isDeleting,
}: {
  message: DocumentMessage;
  isAuthorOnline: boolean;
  onDelete: (messageId: string) => void;
  isDeleting: boolean;
}) {
  const mine = message.isMine;

  return (
    <div
      className={`${classes.messageRow} ${mine ? classes.messageRowMine : classes.messageRowOther}`}
    >
      <div className={classes.messageMeta}>
        {!mine ? (
          <span className={classes.authorRow}>
            <span
              className={`${classes.statusDot} ${
                isAuthorOnline ? classes.statusDotOnline : classes.statusDotOffline
              }`}
              aria-hidden
            />
            <Text component="span" className={classes.messageAuthor}>
              {message.author.name}
            </Text>
          </span>
        ) : (
          <span
            className={`${classes.statusDot} ${
              isAuthorOnline ? classes.statusDotOnline : classes.statusDotOffline
            }`}
            aria-hidden
          />
        )}
        <Text component="span" className={classes.messageTime}>
          {formatMessageTime(message.createdAt)}
        </Text>
        {mine ? (
          <button
            type="button"
            className={classes.deleteBtn}
            aria-label="Mesajı sil"
            disabled={isDeleting}
            onClick={() => onDelete(message.id)}
          >
            <IconTrash size={14} stroke={1.75} />
          </button>
        ) : null}
      </div>
      <div
        className={`${classes.messageBubble} ${
          mine ? classes.messageBubbleMine : classes.messageBubbleOther
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}

export function DocumentMessagesPanel({
  documentId,
  canRead,
  currentUserId,
  activeUserIds,
  typingUsers = [],
  onEmitTyping,
}: DocumentMessagesPanelProps) {
  const messagesQuery = useDocumentMessagesQuery(canRead ? documentId : undefined);
  const createMutation = useCreateDocumentMessageMutation(documentId, currentUserId);
  const deleteMutation = useDeleteDocumentMessageMutation(documentId);

  const [draft, setDraft] = useState('');
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { stopTyping } = useDocumentMessageTyping(onEmitTyping, draft);

  const messages = messagesQuery.data?.messages ?? [];
  const charCount = draft.length;
  const atLimit = charCount >= DOCUMENT_MESSAGE_MAX_LENGTH;
  const typingLabel = formatTypingIndicatorLabel(typingUsers);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
  }, [messages.length, messages[messages.length - 1]?.id, scrollToBottom]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    if (body.length > DOCUMENT_MESSAGE_MAX_LENGTH) return;

    stopTyping();

    createMutation.mutate(body, {
      onSuccess: () => {
        setDraft('');
        requestAnimationFrame(() => scrollToBottom('smooth'));
      },
      onError: (error) => {
        notifications.show({
          color: 'red',
          title: 'Mesaj gönderilemedi',
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  const handleDelete = (messageId: string) => {
    deleteMutation.mutate(messageId, {
      onError: (error) => {
        notifications.show({
          color: 'red',
          title: 'Mesaj silinemedi',
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (createMutation.isPending) return;
    handleSend();
  };

  if (!canRead) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          Bu belgeye erişiminiz yok.
        </Text>
      </Box>
    );
  }

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <Text className={classes.title}>Belge sohbeti</Text>
        <Text className={classes.subtitle}>
          Bu belgeye erişimi olan kullanıcılar burada mesajlaşabilir.
        </Text>
      </header>

      <ScrollArea
        className={classes.messageList}
        type="auto"
        scrollbarSize={6}
        viewportRef={viewportRef}
        classNames={{ viewport: classes.messageListViewport }}
      >
        {messagesQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" color="violet" />
          </Group>
        ) : null}

        {messagesQuery.isError ? (
          <Box className={classes.emptyState}>
            <Text className={classes.emptyTitle}>Mesajlar yüklenemedi</Text>
            <Text className={classes.emptyHint}>
              {axios.isAxiosError(messagesQuery.error)
                ? getApiErrorMessage(messagesQuery.error)
                : 'Bir hata oluştu.'}
            </Text>
          </Box>
        ) : null}

        {messagesQuery.isSuccess && messages.length === 0 ? (
          <Box className={classes.emptyState}>
            <Text className={classes.emptyTitle}>Henüz mesaj yok</Text>
            <Text className={classes.emptyHint}>
              İlk mesajı göndererek konuşmayı başlat.
            </Text>
          </Box>
        ) : null}

        {messages.length > 0 ? (
          <div className={classes.messageStack}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isAuthorOnline={activeUserIds?.has(message.author.id) ?? false}
                onDelete={handleDelete}
                isDeleting={
                  deleteMutation.isPending && deleteMutation.variables === message.id
                }
              />
            ))}
            <div ref={bottomRef} aria-hidden />
          </div>
        ) : null}
      </ScrollArea>

      <Text className={classes.typingIndicator} aria-live="polite">
        {typingLabel || '\u00a0'}
      </Text>

      <footer className={classes.composer}>
        <Textarea
          value={draft}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (next.length <= DOCUMENT_MESSAGE_MAX_LENGTH) {
              setDraft(next);
              return;
            }
            setDraft(next.slice(0, DOCUMENT_MESSAGE_MAX_LENGTH));
          }}
          onKeyDown={handleKeyDown}
          placeholder="Mesaj yaz…"
          minRows={2}
          maxRows={5}
          autosize
          disabled={createMutation.isPending}
          styles={{
            input: {
              background: 'var(--ed-input-bg)',
              borderColor: 'var(--border-color)',
              color: 'var(--ed-text)',
            },
          }}
        />
        <div className={classes.composerFooter}>
          <Text
            className={`${classes.charCount}${atLimit ? ` ${classes.charCountLimit}` : ''}`}
          >
            {charCount}/{DOCUMENT_MESSAGE_MAX_LENGTH}
          </Text>
          <Button
            size="compact-sm"
            leftSection={<IconSend size={14} />}
            loading={createMutation.isPending}
            disabled={!draft.trim()}
            onClick={handleSend}
          >
            Gönder
          </Button>
        </div>
      </footer>
    </div>
  );
}
