import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconChevronRight, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { AppCard } from '../../../components/ui/AppCard';
import { DocumentFavoriteButton } from './DocumentFavoriteButton';
import type { DocumentListItem } from '../types/document.types';

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

interface DocumentCardProps {
  document: DocumentListItem;
  onDelete?: (document: DocumentListItem) => void;
  deleteLoading?: boolean;
}

export function DocumentCard({
  document,
  onDelete,
  deleteLoading,
}: DocumentCardProps) {
  return (
    <Link
      to={`/documents/${document.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <AppCard
        w="100%"
        p="lg"
        radius="lg"
        styles={{
          root: {
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 120ms ease, background-color 120ms ease',
            '&:hover': {
              borderColor: 'var(--mantine-color-violet-4)',
              backgroundColor: 'var(--card-bg)',
            },
          },
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap="xs" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="lg" lineClamp={2}>
              {document.title}
            </Text>
            <Text size="sm" c="dimmed" ff="monospace" lineClamp={1}>
              {document.slug}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color="violet">
                v{document.currentVersion}
              </Badge>
              <Text size="xs" c="dimmed">
                Updated {formatUpdatedAt(document.updatedAt)}
              </Text>
            </Group>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <DocumentFavoriteButton
              documentId={document.id}
              isFavorite={document.isFavorite ?? false}
            />
            {onDelete ? (
              <Tooltip label="Çöp Kutusuna Taşı" withArrow position="top">
                <ActionIcon
                  variant="subtle"
                  color="orange"
                  aria-label="Çöp Kutusuna Taşı"
                  loading={deleteLoading}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(document);
                  }}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
          </Group>
        </Group>
      </AppCard>
    </Link>
  );
}
