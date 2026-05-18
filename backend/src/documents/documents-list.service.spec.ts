import {
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { DocumentRole, WorkspaceRole } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

describe('DocumentsService list & summary', () => {
  let service: DocumentsService;

  const prismaMock = {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    documentFavorite: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.documentFavorite.findMany.mockResolvedValue([]);
    prismaMock.documentFavorite.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(DocumentsService);
  });

  it('summary counts active accessible documents', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        createdById: 'user-a',
        updatedAt: new Date(),
        members: [{ role: DocumentRole.OWNER }],
      },
      {
        id: 'doc-2',
        createdById: 'user-b',
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        members: [{ role: DocumentRole.EDITOR }],
      },
    ]);
    prismaMock.documentFavorite.count.mockResolvedValue(1);

    const summary = await service.getDocumentsSummary('user-a');

    expect(summary.totalDocuments).toBe(2);
    expect(summary.ownedDocuments).toBe(1);
    expect(summary.sharedDocuments).toBe(1);
    expect(summary.favoriteDocuments).toBe(1);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('summary counts recently updated in last 7 days', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        createdById: 'user-a',
        updatedAt: new Date(),
        members: [{ role: DocumentRole.OWNER }],
      },
      {
        id: 'doc-2',
        createdById: 'user-a',
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        members: [{ role: DocumentRole.OWNER }],
      },
    ]);

    const summary = await service.getDocumentsSummary('user-a');

    expect(summary.recentlyUpdated).toBe(1);
  });

  it('list query excludes deleted documents', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);

    await service.listAccessibleDocuments('user-a', {});

    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('list filters owned view', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Owned',
        slug: 'owned',
        workspaceId: 'ws-1',
        previewContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentVersion: 0,
        createdById: 'user-a',
        workspace: { name: 'Takım', members: [] },
        createdBy: {
          id: 'user-a',
          fullName: 'User A',
          email: 'a@test.com',
        },
        members: [
          {
            userId: 'user-a',
            role: DocumentRole.OWNER,
            user: { id: 'user-a', fullName: 'User A', email: 'a@test.com' },
          },
        ],
        _count: { members: 1 },
      },
      {
        id: 'doc-2',
        title: 'Shared',
        slug: 'shared',
        workspaceId: 'ws-1',
        previewContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentVersion: 0,
        createdById: 'user-b',
        workspace: { name: 'Takım', members: [] },
        createdBy: {
          id: 'user-b',
          fullName: 'User B',
          email: 'b@test.com',
        },
        members: [
          {
            userId: 'user-a',
            role: DocumentRole.EDITOR,
            user: { id: 'user-a', fullName: 'User A', email: 'a@test.com' },
          },
          {
            userId: 'user-b',
            role: DocumentRole.OWNER,
            user: { id: 'user-b', fullName: 'User B', email: 'b@test.com' },
          },
        ],
        _count: { members: 2 },
      },
    ]);

    const result = await service.listAccessibleDocuments('user-a', {
      view: 'owned',
    });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe('doc-1');
    expect(result.documents[0].isShared).toBe(false);
  });

  it('list marks favorites and permissions', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Plan',
        slug: 'plan',
        workspaceId: 'ws-1',
        previewContent: 'hello',
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        updatedAt: new Date('2026-05-09T10:00:00.000Z'),
        currentVersion: 2,
        createdById: 'user-a',
        workspace: {
          name: 'Takım',
          members: [{ role: WorkspaceRole.OWNER }],
        },
        createdBy: {
          id: 'user-a',
          fullName: 'User A',
          email: 'a@test.com',
        },
        members: [
          {
            userId: 'user-a',
            role: DocumentRole.OWNER,
            user: { id: 'user-a', fullName: 'User A', email: 'a@test.com' },
          },
        ],
        _count: { members: 1 },
      },
    ]);
    prismaMock.documentFavorite.findMany.mockResolvedValue([
      { documentId: 'doc-1' },
    ]);

    const result = await service.listAccessibleDocuments('user-a', {});

    expect(result.documents[0].isFavorite).toBe(true);
    expect(result.documents[0].canShare).toBe(true);
    expect(result.documents[0].canDelete).toBe(true);
    expect(result.documents[0].owner.name).toBe('User A');
  });

  it('renames document when user can edit', async () => {
    prismaMock.document.findUnique
      .mockResolvedValueOnce({
        id: 'doc-1',
        title: 'Eski',
        workspaceId: 'ws-1',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        workspaceId: 'ws-1',
        deletedAt: null,
        members: [{ role: DocumentRole.OWNER }],
        workspace: { members: [] },
      });
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.update.mockResolvedValue({
      id: 'doc-1',
      title: 'Yeni Başlık',
      slug: 'yeni-baslik',
      updatedAt: new Date(),
    });
    prismaMock.activityLog.create.mockResolvedValue({ id: 'act-1' });

    const result = await service.updateDocument('user-a', 'doc-1', {
      title: 'Yeni Başlık',
    });

    expect(result.document.title).toBe('Yeni Başlık');
    expect(prismaMock.document.update).toHaveBeenCalled();
  });

  it('rejects rename for deleted document', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'Eski',
      workspaceId: 'ws-1',
      deletedAt: new Date(),
    });

    await expect(
      service.updateDocument('user-a', 'doc-1', { title: 'Yeni' }),
    ).rejects.toThrow(GoneException);
  });

  it('allows editor to rename document', async () => {
    prismaMock.document.findUnique
      .mockResolvedValueOnce({
        id: 'doc-1',
        title: 'Eski',
        workspaceId: 'ws-1',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        workspaceId: 'ws-1',
        deletedAt: null,
        members: [{ role: DocumentRole.EDITOR }],
        workspace: { members: [] },
      });
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.update.mockResolvedValue({
      id: 'doc-1',
      title: 'Yeni',
      slug: 'yeni',
      updatedAt: new Date(),
    });
    prismaMock.activityLog.create.mockResolvedValue({ id: 'act-1' });

    const result = await service.updateDocument('user-b', 'doc-1', {
      title: 'Yeni',
    });

    expect(result.document.title).toBe('Yeni');
  });

  it('rejects rename for viewer', async () => {
    prismaMock.document.findUnique
      .mockResolvedValueOnce({
        id: 'doc-1',
        title: 'Eski',
        workspaceId: 'ws-1',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        workspaceId: 'ws-1',
        deletedAt: null,
        members: [{ role: DocumentRole.VIEWER }],
        workspace: { members: [] },
      });

    await expect(
      service.updateDocument('user-b', 'doc-1', { title: 'Yeni' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bulk trash reports partial failures for unauthorized documents', async () => {
    prismaMock.document.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === 'doc-1') {
          return {
            id: 'doc-1',
            title: 'A',
            workspaceId: 'ws-1',
            deletedAt: null,
            createdById: 'user-a',
            members: [{ role: DocumentRole.OWNER }],
            workspace: { members: [] },
          };
        }
        if (where.id === 'doc-2') {
          return {
            id: 'doc-2',
            title: 'B',
            workspaceId: 'ws-1',
            deletedAt: null,
            createdById: 'user-b',
            members: [{ role: DocumentRole.VIEWER }],
            workspace: { members: [] },
          };
        }
        return null;
      },
    );
    prismaMock.document.update.mockResolvedValue({ id: 'doc-1' });
    prismaMock.activityLog.create.mockResolvedValue({ id: 'act-1' });

    const result = await service.bulkMoveToTrash('user-a', {
      documentIds: ['doc-1', 'doc-2'],
    });

    expect(result.movedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures?.[0].id).toBe('doc-2');
  });

  it('summary excludes deleted documents from counts', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.documentFavorite.count.mockResolvedValue(0);

    await service.getDocumentsSummary('user-a');

    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
