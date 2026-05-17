import { Badge, Group, Stack, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { AppCard } from '../../../components/ui/AppCard';
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
}

export function DocumentCard({ document }: DocumentCardProps) {
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
          <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
        </Group>
      </AppCard>
    </Link>
  );
}
