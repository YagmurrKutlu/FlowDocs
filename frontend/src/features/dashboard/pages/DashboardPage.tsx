import {
  Badge,
  Button,
  Grid,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateDocumentModal } from '../../documents/components/CreateDocumentModal';
import { useDocumentsListQuery } from '../../documents/hooks/useDocumentsQueries';
import type { DocumentListItem } from '../../documents/types/document.types';
import { AppCard } from '../../../components/ui/AppCard';
import { PageContainer } from '../../../components/ui/PageContainer';
import { apiClient } from '../../../shared/api/client';
import type { WorkspaceListResponse, WorkspaceResponse } from '../../../shared/api/contracts';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import { DashboardDocumentCard } from '../components/DashboardDocumentCard';
import { DashboardNewDocumentCard } from '../components/DashboardNewDocumentCard';
import { DashboardStatCard } from '../components/DashboardStatCard';
import { ManageWorkspaceMembersModal } from '../components/ManageWorkspaceMembersModal';
import pageStyles from './DashboardPage.module.css';

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters.'),
  description: z.string().trim().max(240, 'Description is too long.').optional(),
});

type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceSchema>;

function isLiveRecently(iso: string, hours: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hours * 3600000;
}

function isThisCalendarWeek(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - diffToMonday);
  return d >= start;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const isTeamTab = searchParams.get('tab') === 'team';

  const [search, setSearch] = useState('');
  const [opened, { open, close }] = useDisclosure(false);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [membersModalOpened, { open: openMembersModal, close: closeMembersModal }] =
    useDisclosure(false);
  const [membersWorkspaceId, setMembersWorkspaceId] = useState<string | null>(null);
  const [membersWorkspaceName, setMembersWorkspaceName] = useState('');
  const [membersCanManage, setMembersCanManage] = useState(false);

  const listQuery = useDocumentsListQuery();
  const documents = listQuery.data?.documents ?? [];

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  const stats = useMemo(() => {
    const total = documents.length;
    const live = documents.filter((d) => isLiveRecently(d.updatedAt, 72)).length;
    const week = documents.filter((d) => isThisCalendarWeek(d.updatedAt)).length;
    return { total, live, week };
  }, [documents]);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkspaceListResponse>('/workspaces');
      return data;
    },
  });

  const teamMemberSum = useMemo(() => {
    const list = workspacesQuery.data?.workspaces ?? [];
    if (list.length === 0) return 0;
    return list.reduce((acc, w) => acc + (w.memberCount ?? 0), 0);
  }, [workspacesQuery.data]);

  const teamStatDisplay =
    workspacesQuery.isLoading ? '…' : workspacesQuery.isError ? '—' : teamMemberSum;

  const handleOpenMembersModal = (workspace: {
    id: string;
    name: string;
    role: string;
  }) => {
    setMembersWorkspaceId(workspace.id);
    setMembersWorkspaceName(workspace.name);
    setMembersCanManage(workspace.role === 'OWNER' || workspace.role === 'ADMIN');
    openMembersModal();
  };

  const handleCloseMembersModal = () => {
    closeMembersModal();
    setMembersWorkspaceId(null);
    setMembersWorkspaceName('');
    setMembersCanManage(false);
  };

  const form = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (values: CreateWorkspaceFormValues) => {
      const { data } = await apiClient.post<WorkspaceResponse>('/workspaces', values);
      return data;
    },
    onSuccess: (data) => {
      notifications.show({
        color: 'teal',
        title: 'Workspace created',
        message: `${data.workspace.name} is ready.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      form.reset();
      close();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Workspace creation failed',
        message: getApiErrorMessage(error),
      });
    },
  });

  const workspaceItems = workspacesQuery.data?.workspaces ?? [];
  const workspaceCount = workspaceItems.length;
  const onSubmit = form.handleSubmit((values) => {
    createWorkspaceMutation.mutate(values);
  });

  if (isTeamTab) {
    return (
      <PageContainer>
        <Stack>
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={2}>Çalışma alanı</Title>
              <Text c="dimmed">
                Welcome back{user ? `, ${user.fullName}` : ''}. Manage your workspaces and account from here.
              </Text>
            </div>
            <Button onClick={open}>New workspace</Button>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <AppCard p="lg">
                <Text fw={600}>Active Workspaces</Text>
                <Text size="xl" mt="sm">
                  {workspacesQuery.isLoading ? <Loader size="sm" color="violet" /> : workspaceCount}
                </Text>
              </AppCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <AppCard p="lg">
                <Text fw={600}>Current User</Text>
                <Text size="xl" mt="sm">
                  {user?.fullName ?? '--'}
                </Text>
              </AppCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <AppCard p="lg">
                <Text fw={600}>Session</Text>
                <Text size="xl" mt="sm">
                  {user?.email ?? '--'}
                </Text>
              </AppCard>
            </Grid.Col>
          </Grid>

          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Title order={3}>Your Workspaces</Title>
                <Text c="dimmed" size="sm">
                  Only workspaces you belong to are listed here.
                </Text>
              </div>
              {workspaceCount === 0 ? <Badge color="orange">Setup needed</Badge> : null}
            </Group>

            {workspacesQuery.isLoading ? (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Skeleton h={180} radius="lg" />
                <Skeleton h={180} radius="lg" />
              </SimpleGrid>
            ) : null}

            {workspacesQuery.isError ? (
              <AppCard p="lg">
                <Text fw={600}>Could not load workspaces</Text>
                <Text c="dimmed" mt="xs">
                  {getApiErrorMessage(workspacesQuery.error)}
                </Text>
              </AppCard>
            ) : null}

            {!workspacesQuery.isLoading &&
            !workspacesQuery.isError &&
            workspaceCount === 0 ? (
              <AppCard p="xl">
                <Stack gap="sm">
                  <Title order={4}>Create your first workspace</Title>
                  <Text c="dimmed">
                    Start by creating a shared space for your team, documents, and future collaboration activity.
                  </Text>
                  <Group>
                    <Button onClick={open}>Create workspace</Button>
                  </Group>
                </Stack>
              </AppCard>
            ) : null}

            {!workspacesQuery.isLoading &&
            !workspacesQuery.isError &&
            workspaceCount > 0 ? (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {workspaceItems.map((workspace) => (
                  <AppCard key={workspace.id} p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Title order={4}>{workspace.name}</Title>
                          <Text c="dimmed" size="sm">
                            {workspace.slug}
                          </Text>
                        </div>
                        <Badge color="violet" variant="light">
                          {workspace.role}
                        </Badge>
                      </Group>
                      <Text c="dimmed">
                        {workspace.description || 'No description yet.'}
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        <Badge variant="dot">{workspace.memberCount} members</Badge>
                        <Badge variant="light" color="gray">
                          Owner: {workspace.owner.fullName}
                        </Badge>
                        <Button
                          variant="light"
                          size="compact-sm"
                          onClick={() => handleOpenMembersModal(workspace)}
                        >
                          Manage members
                        </Button>
                      </Group>
                    </Stack>
                  </AppCard>
                ))}
              </SimpleGrid>
            ) : null}
          </Stack>
        </Stack>

        <ManageWorkspaceMembersModal
          opened={membersModalOpened}
          onClose={handleCloseMembersModal}
          workspaceId={membersWorkspaceId}
          workspaceName={membersWorkspaceName}
          canManageMembers={membersCanManage}
        />

        <Modal opened={opened} onClose={close} title="Create workspace" centered>
          <form onSubmit={onSubmit}>
            <Stack>
              <TextInput
                label="Workspace name"
                placeholder="Acme Product"
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
              <TextInput
                label="Description"
                placeholder="Optional"
                {...form.register('description')}
                error={form.formState.errors.description?.message}
              />
              <Button type="submit" loading={createWorkspaceMutation.isPending}>
                Create workspace
              </Button>
            </Stack>
          </form>
        </Modal>
      </PageContainer>
    );
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.topbar}>
        <div className={pageStyles.titleBlock}>
          <h1 className={pageStyles.pageTitle}>Dashboard</h1>
          <p className={pageStyles.pageSubtitle}>Tüm dokümanlarınız</p>
        </div>
        <div className={pageStyles.topbarActions}>
          <TextInput
            className={pageStyles.search}
            classNames={{ input: pageStyles.searchControl }}
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={16} color="rgba(255,255,255,0.35)" />}
          />
          <Button className={pageStyles.newDocBtn} leftSection={<span>+</span>} onClick={openCreate}>
            Yeni Doküman
          </Button>
        </div>
      </header>

      <div className={pageStyles.statsRow}>
        <DashboardStatCard value={stats.total} label="Toplam Doküman" accent="blue" />
        <DashboardStatCard value={stats.live} label="Canlı / Aktif" accent="green" />
        <DashboardStatCard value={stats.week} label="Bu Hafta Düzenlendi" accent="orange" />
        <DashboardStatCard value={teamStatDisplay} label="Ekip Üyesi" accent="white" />
      </div>

      {listQuery.isLoading ? (
        <div className={pageStyles.docGrid}>
          <Skeleton height={200} radius={14} />
          <Skeleton height={200} radius={14} />
          <Skeleton height={200} radius={14} />
        </div>
      ) : null}

      {listQuery.isError ? (
        <Stack mt="xl">
          <Text c="red.4">{getApiErrorMessage(listQuery.error)}</Text>
        </Stack>
      ) : null}

      {!listQuery.isLoading && !listQuery.isError ? (
        <div className={pageStyles.docGrid}>
          {filteredDocuments.map((doc: DocumentListItem, index: number) => (
            <DashboardDocumentCard key={doc.id} document={doc} index={index} />
          ))}
          <DashboardNewDocumentCard onClick={openCreate} />
        </div>
      ) : null}

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni doküman" centered radius="md">
        <CreateDocumentModal
          opened={createOpened}
          onClose={closeCreate}
          onCreated={(id) => {
            closeCreate();
            navigate(`/documents/${id}`);
          }}
        />
      </Modal>
    </div>
  );
}
