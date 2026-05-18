import {
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { DocumentRole, WorkspaceRole } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SharedService } from './shared.service';

describe('SharedService', () => {
  let service: SharedService;

  const prismaMock = {
    documentMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
    },
    documentFavorite: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.documentFavorite.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(SharedService);
  });

  it('lists with-me documents shared to current user excluding owner role', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-05-10T10:00:00.000Z'),
        role: DocumentRole.EDITOR,
        document: {
          id: 'doc-1',
          title: 'Plan',
          workspaceId: 'ws-1',
          previewContent: null,
          updatedAt: new Date('2026-05-09T10:00:00.000Z'),
          createdAt: new Date('2026-05-01T10:00:00.000Z'),
          createdBy: {
            id: 'owner-1',
            fullName: 'Owner User',
            email: 'owner@test.com',
          },
          workspace: { name: 'Takım' },
          members: [
            {
              role: DocumentRole.OWNER,
              createdAt: new Date('2026-05-01T10:00:00.000Z'),
              user: {
                id: 'owner-1',
                fullName: 'Owner User',
                email: 'owner@test.com',
              },
            },
          ],
          _count: { members: 3 },
        },
      },
    ]);

    const result = await service.listWithMe('user-b', { sort: 'recent' });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].myRole).toBe('EDITOR');
    expect(result.documents[0].owner.id).toBe('owner-1');
    expect(prismaMock.documentMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-b',
          role: { not: DocumentRole.OWNER },
          document: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    );
  });

  it('lists by-me documents owned and shared with others', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Brief',
        workspaceId: 'ws-1',
        previewContent: null,
        updatedAt: new Date('2026-05-09T10:00:00.000Z'),
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        workspace: { name: 'Takım' },
        members: [
          { userId: 'user-a', role: DocumentRole.OWNER },
          { userId: 'user-b', role: DocumentRole.EDITOR },
          { userId: 'user-c', role: DocumentRole.VIEWER },
        ],
      },
    ]);

    const result = await service.listByMe('user-a', { sort: 'updated' });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].sharedUserCount).toBe(2);
    expect(result.documents[0].editorCount).toBe(1);
    expect(result.documents[0].viewerCount).toBe(1);
  });

  it('computes summary from real membership queries', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([
      {
        role: DocumentRole.EDITOR,
        document: {
          workspaceId: 'ws-1',
          updatedAt: new Date(),
        },
      },
      {
        role: DocumentRole.VIEWER,
        document: {
          workspaceId: 'ws-2',
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      },
    ]);
    prismaMock.document.findMany.mockResolvedValue([
      {
        workspaceId: 'ws-1',
        updatedAt: new Date(),
      },
    ]);

    const summary = await service.getSummary('user-1');

    expect(summary.withMeCount).toBe(2);
    expect(summary.byMeCount).toBe(1);
    expect(summary.editorAccessCount).toBe(1);
    expect(summary.viewerAccessCount).toBe(1);
    expect(summary.workspaceCount).toBe(2);
  });

  it('excludes deleted documents from with-me query', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([]);

    await service.listWithMe('user-1', {});

    expect(prismaMock.documentMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          document: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    );
  });

  it('excludes deleted documents from by-me query', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);

    await service.listByMe('user-1', {});

    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('filters with-me by role when provided', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([]);

    await service.listWithMe('user-1', { role: DocumentRole.VIEWER });

    expect(prismaMock.documentMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: DocumentRole.VIEWER,
        }),
      }),
    );
  });

  it('allows editor to leave shared document', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'owner-1',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: DocumentRole.EDITOR,
    });
    prismaMock.documentMember.delete.mockResolvedValue({ id: 'mem-1' });

    const result = await service.leaveWithMe('user-b', 'doc-1');

    expect(result.message).toBe('Doküman erişiminiz kaldırıldı.');
    expect(prismaMock.documentMember.delete).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
    });
  });

  it('rejects leave for document owner', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'user-a',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      role: DocumentRole.OWNER,
    });

    await expect(service.leaveWithMe('user-a', 'doc-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects leave for deleted document', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: new Date(),
      createdById: 'owner-1',
      workspaceId: 'ws-1',
    });

    await expect(service.leaveWithMe('user-b', 'doc-1')).rejects.toThrow(
      GoneException,
    );
  });

  it('returns idempotent message when user is not a document member', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'owner-1',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue(null);
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);

    const result = await service.leaveWithMe('user-b', 'doc-1');

    expect(result.message).toBe('Erişim zaten kaldırılmış.');
  });

  it('rejects leave when access is via workspace membership', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'owner-1',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue(null);
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    });

    await expect(service.leaveWithMe('user-b', 'doc-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('with-me query excludes owner role when no role filter', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([]);

    await service.listWithMe('user-1', {});

    expect(prismaMock.documentMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { not: DocumentRole.OWNER },
        }),
      }),
    );
  });

  it('with-me role filter matches exact role only', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([
      {
        createdAt: new Date(),
        role: DocumentRole.EDITOR,
        document: {
          id: 'doc-1',
          title: 'Plan',
          workspaceId: 'ws-1',
          previewContent: null,
          updatedAt: new Date(),
          createdAt: new Date(),
          createdBy: {
            id: 'owner-1',
            fullName: 'Owner',
            email: 'owner@test.com',
          },
          workspace: { name: 'Takım' },
          members: [],
          _count: { members: 2 },
        },
      },
    ]);

    const result = await service.listWithMe('user-1', {
      role: DocumentRole.EDITOR,
    });

    expect(result.documents[0].myRole).toBe('EDITOR');
    expect(prismaMock.documentMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: DocumentRole.EDITOR,
        }),
      }),
    );
  });

  it('by-me query requires current user as owner and at least one other member', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);

    await service.listByMe('user-a', {});

    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          members: expect.objectContaining({
            some: { userId: 'user-a', role: DocumentRole.OWNER },
          }),
          AND: [
            {
              members: {
                some: { userId: { not: 'user-a' } },
              },
            },
          ],
        }),
      }),
    );
  });

  it('rejects leave for last owner who is not the creator', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'creator-1',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue({
      id: 'mem-owner',
      role: DocumentRole.OWNER,
    });
    prismaMock.documentMember.count.mockResolvedValue(1);

    await expect(service.leaveWithMe('user-x', 'doc-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.documentMember.delete).not.toHaveBeenCalled();
  });

  it('leave deletes only the current user membership record', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
      createdById: 'owner-1',
      workspaceId: 'ws-1',
    });
    prismaMock.documentMember.findUnique.mockResolvedValue({
      id: 'mem-editor-b',
      role: DocumentRole.EDITOR,
    });
    prismaMock.documentMember.delete.mockResolvedValue({ id: 'mem-editor-b' });

    await service.leaveWithMe('user-b', 'doc-1');

    expect(prismaMock.documentMember.findUnique).toHaveBeenCalledWith({
      where: {
        documentId_userId: {
          documentId: 'doc-1',
          userId: 'user-b',
        },
      },
      select: { id: true, role: true },
    });
    expect(prismaMock.documentMember.delete).toHaveBeenCalledWith({
      where: { id: 'mem-editor-b' },
    });
  });

  it('maps empty owner name to Bilinmiyor on with-me documents', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([
      {
        createdAt: new Date(),
        role: DocumentRole.VIEWER,
        document: {
          id: 'doc-1',
          title: 'Plan',
          workspaceId: 'ws-1',
          previewContent: null,
          updatedAt: new Date(),
          createdAt: new Date(),
          createdBy: {
            id: 'owner-1',
            fullName: '   ',
            email: 'owner@test.com',
          },
          workspace: { name: 'Takım' },
          members: [
            {
              role: DocumentRole.OWNER,
              createdAt: new Date(),
              user: {
                id: 'owner-1',
                fullName: '',
                email: 'owner@test.com',
              },
            },
          ],
          _count: { members: 2 },
        },
      },
    ]);

    const result = await service.listWithMe('user-b', {});

    expect(result.documents[0].owner.name).toBe('Bilinmiyor');
  });

  it('marks favorites on with-me documents', async () => {
    prismaMock.documentMember.findMany.mockResolvedValue([
      {
        createdAt: new Date(),
        role: DocumentRole.EDITOR,
        document: {
          id: 'doc-1',
          title: 'Plan',
          workspaceId: 'ws-1',
          previewContent: null,
          updatedAt: new Date(),
          createdAt: new Date(),
          createdBy: {
            id: 'owner-1',
            fullName: 'Owner',
            email: 'owner@test.com',
          },
          workspace: { name: 'Takım' },
          members: [],
          _count: { members: 2 },
        },
      },
    ]);
    prismaMock.documentFavorite.findMany.mockResolvedValue([
      { documentId: 'doc-1' },
    ]);

    const result = await service.listWithMe('user-b', {});

    expect(result.documents[0].isFavorite).toBe(true);
  });
});
