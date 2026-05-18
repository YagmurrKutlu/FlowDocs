import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentRole, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrashService } from './trash.service';

describe('TrashService', () => {
  let service: TrashService;

  const prismaMock = {
    document: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documentMessage: { deleteMany: jest.fn() },
    documentComment: { deleteMany: jest.fn() },
    documentUpdate: { deleteMany: jest.fn() },
    documentSnapshot: { deleteMany: jest.fn() },
    documentMember: { deleteMany: jest.fn() },
    mediaFile: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const managedDoc = {
    id: 'doc-1',
    deletedAt: new Date(),
    title: 'Test',
    workspaceId: 'ws-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(TrashService);
  });

  it('returns trash summary for manageable documents', async () => {
    prismaMock.document.count.mockResolvedValue(2);
    prismaMock.document.findFirst.mockResolvedValue({
      deletedAt: new Date('2026-05-01T10:00:00.000Z'),
    });

    const result = await service.getSummary('user-1');

    expect(result.deletedDocumentCount).toBe(2);
    expect(result.restorableCount).toBe(2);
    expect(result.retentionPolicyDays).toBe(30);
    expect(result.oldestDeletedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('restores a deleted document', async () => {
    prismaMock.document.findFirst.mockResolvedValue(managedDoc);
    prismaMock.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          document: {
            update: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Test' }),
          },
          activityLog: { create: jest.fn().mockResolvedValue({}) },
        });
      }
      return [];
    });

    const result = await service.restoreDocument('user-1', 'doc-1');

    expect(result.message).toBe('Doküman geri yüklendi.');
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('rejects restore when document is not in trash', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
    });

    await expect(service.restoreDocument('user-1', 'doc-1')).rejects.toThrow(
      new BadRequestException('Doküman çöp kutusunda değil.'),
    );
  });

  it('rejects permanent delete when document is not in trash', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
    });

    await expect(
      service.permanentDeleteDocument('user-1', 'doc-1'),
    ).rejects.toThrow(new BadRequestException('Doküman çöp kutusunda değil.'));
  });

  it('rejects unauthorized restore', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: new Date(),
    });

    await expect(service.restoreDocument('user-1', 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects unauthorized permanent delete', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: new Date(),
    });

    await expect(
      service.permanentDeleteDocument('user-1', 'doc-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 for permanently deleted document id', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue(null);

    await expect(
      service.permanentDeleteDocument('user-1', 'gone-doc'),
    ).rejects.toThrow(NotFoundException);
  });

  it('permanently deletes related records in transaction', async () => {
    prismaMock.document.findFirst.mockResolvedValue(managedDoc);
    prismaMock.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          activityLog: { create: jest.fn().mockResolvedValue({}) },
          documentMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentComment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentUpdate: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentSnapshot: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentMember: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          mediaFile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          document: { delete: jest.fn().mockResolvedValue({}) },
        });
      }
      return [];
    });

    const result = await service.permanentDeleteDocument('user-1', 'doc-1');

    expect(result.message).toBe('Doküman kalıcı olarak silindi.');
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('lists only trashable documents for user', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Silinen',
        workspaceId: 'ws-1',
        updatedAt: new Date('2026-05-10T12:00:00.000Z'),
        deletedAt: new Date('2026-05-09T12:00:00.000Z'),
        workspace: { name: 'Takım' },
        deletedBy: {
          id: 'user-1',
          fullName: 'Ali',
          email: 'ali@test.com',
        },
        _count: { members: 2 },
      },
    ]);

    const result = await service.listDocuments('user-1', { sort: 'newest' });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].deletedBy?.name).toBe('Ali');
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: { not: null },
          OR: expect.arrayContaining([
            { createdById: 'user-1' },
            {
              members: {
                some: { userId: 'user-1', role: DocumentRole.OWNER },
              },
            },
            {
              workspace: {
                members: {
                  some: { userId: 'user-1', role: WorkspaceRole.OWNER },
                },
              },
            },
          ]),
        }),
      }),
    );
  });

  it('bulk restore reports partial failures', async () => {
    prismaMock.document.findFirst
      .mockResolvedValueOnce(managedDoc)
      .mockResolvedValueOnce(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-2',
      deletedAt: new Date(),
    });
    prismaMock.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          document: {
            update: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Test' }),
          },
          activityLog: { create: jest.fn().mockResolvedValue({}) },
        });
      }
      return [];
    });

    const result = await service.bulkRestore('user-1', {
      documentIds: ['doc-1', 'doc-2'],
    });

    expect(result.restoredCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'doc-2' }),
      ]),
    );
  });

  it('bulk permanent delete reports partial failures', async () => {
    prismaMock.document.findFirst
      .mockResolvedValueOnce(managedDoc)
      .mockResolvedValueOnce(null);
    prismaMock.document.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          activityLog: { create: jest.fn().mockResolvedValue({}) },
          documentMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentComment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentUpdate: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentSnapshot: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          documentMember: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          mediaFile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          document: { delete: jest.fn().mockResolvedValue({}) },
        });
      }
      return [];
    });

    const result = await service.bulkPermanentDelete('user-1', {
      documentIds: ['doc-1', 'doc-gone'],
    });

    expect(result.deletedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures?.[0]?.id).toBe('doc-gone');
  });
});
