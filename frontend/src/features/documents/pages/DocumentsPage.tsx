import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../../components/ui/PageContainer';
import { AppCard } from '../../../components/ui/AppCard';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { CreateDocumentModal } from '../components/CreateDocumentModal';
import { DocumentCard } from '../components/DocumentCard';
import { MoveToTrashModal } from '../components/MoveToTrashModal';
import {
  useDeleteDocumentMutation,
  useDocumentsListQuery,
} from '../hooks/useDocumentsQueries';
import type { DocumentListItem } from '../types/document.types';

export function DocumentsPage() {
  const navigate = useNavigate();
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const listQuery = useDocumentsListQuery();
  const deleteMutation = useDeleteDocumentMutation();
  const [trashTarget, setTrashTarget] = useState<DocumentListItem | null>(null);

  const documents = listQuery.data?.documents ?? [];

  const handleMoveToTrash = (doc: DocumentListItem) => {
    setTrashTarget(doc);
  };

  const confirmMoveToTrash = () => {
    if (!trashTarget) return;
    void deleteMutation.mutate(trashTarget.id, {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message: 'Doküman çöp kutusuna taşındı.',
        });
        setTrashTarget(null);
      },
      onError: (error) => {
        notifications.show({
          color: 'red',
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  return (
    <PageContainer>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={2}>Documents</Title>
            <Text c="dimmed" maw={560}>
              Documents you can access across your workspaces. Editor integration
              comes in a later step.
            </Text>
          </div>
          <Button onClick={openCreate}>New document</Button>
        </Group>

        {listQuery.isLoading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Skeleton h={140} radius="lg" />
            <Skeleton h={140} radius="lg" />
            <Skeleton h={140} radius="lg" />
          </SimpleGrid>
        ) : null}

        {listQuery.isError ? (
          <Alert color="red" title="Could not load documents" radius="md">
            {getApiErrorMessage(listQuery.error)}
          </Alert>
        ) : null}

        {!listQuery.isLoading &&
        !listQuery.isError &&
        documents.length === 0 ? (
          <AppCard p="xl" radius="lg">
            <Stack align="center" gap="md" py="md">
              <Text fw={600} size="lg" ta="center">
                No documents yet
              </Text>
              <Text c="dimmed" ta="center" maw={420}>
                Create your first document in one of your workspaces. You need at
                least one workspace before you can add documents.
              </Text>
              <Button onClick={openCreate}>Create document</Button>
            </Stack>
          </AppCard>
        ) : null}

        {!listQuery.isLoading && !listQuery.isError && documents.length > 0 ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={handleMoveToTrash}
                deleteLoading={
                  deleteMutation.isPending && deleteMutation.variables === doc.id
                }
              />
            ))}
          </SimpleGrid>
        ) : null}

        {listQuery.isFetching && !listQuery.isLoading ? (
          <Group justify="center" py="xs">
            <Loader size="sm" color="violet" />
            <Text size="sm" c="dimmed">
              Refreshing…
            </Text>
          </Group>
        ) : null}
      </Stack>

      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="New document"
        centered
        radius="md"
      >
        <CreateDocumentModal
          opened={createOpened}
          onClose={closeCreate}
          onCreated={(id) => {
            navigate(`/documents/${id}`, { replace: false });
          }}
        />
      </Modal>

      <MoveToTrashModal
        opened={trashTarget !== null}
        documentTitle={trashTarget?.title ?? ''}
        loading={deleteMutation.isPending}
        onClose={() => setTrashTarget(null)}
        onConfirm={confirmMoveToTrash}
      />
    </PageContainer>
  );
}
