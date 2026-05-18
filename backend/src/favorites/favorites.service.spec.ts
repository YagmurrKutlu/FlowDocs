import {
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const prismaMock = {
    documentFavorite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  it('lists only current user favorites for accessible non-deleted documents', async () => {
    prismaMock.documentFavorite.findMany.mockResolvedValue([
      {
        id: 'fav-1',
        createdAt: new Date('2026-05-10T10:00:00.000Z'),
        document: {
          id: 'doc-1',
          title: 'Plan',
          workspaceId: 'ws-1',
          previewContent: null,
          updatedAt: new Date('2026-05-09T10:00:00.000Z'),
          members: [{ role: 'EDITOR' }],
          workspace: { name: 'Takım', members: [] },
          _count: { members: 2 },
        },
      },
    ]);

    const result = await service.listFavorites('user-1', { sort: 'recent' });

    expect(result.favorites).toHaveLength(1);
    expect(result.favorites[0].isFavorite).toBe(true);
    expect(prismaMock.documentFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          document: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    );
  });

  it('adds favorite for accessible document', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
    });
    prismaMock.documentFavorite.findUnique.mockResolvedValue(null);
    prismaMock.documentFavorite.create.mockResolvedValue({ id: 'fav-1' });

    const result = await service.addFavorite('user-1', 'doc-1');

    expect(result.message).toBe('Doküman favorilere eklendi.');
    expect(prismaMock.documentFavorite.create).toHaveBeenCalled();
  });

  it('is idempotent when favorite already exists', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
    });
    prismaMock.documentFavorite.findUnique.mockResolvedValue({ id: 'fav-1' });

    const result = await service.addFavorite('user-1', 'doc-1');

    expect(result.message).toBe('Doküman zaten favorilerde.');
    expect(prismaMock.documentFavorite.create).not.toHaveBeenCalled();
  });

  it('rejects favorite for deleted document', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: new Date(),
    });

    await expect(service.addFavorite('user-1', 'doc-1')).rejects.toThrow(
      GoneException,
    );
  });

  it('rejects favorite without document access', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      deletedAt: null,
    });

    await expect(service.addFavorite('user-1', 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('removes favorite idempotently', async () => {
    prismaMock.documentFavorite.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.removeFavorite('user-1', 'doc-1');

    expect(result.message).toBe('Doküman favorilerden çıkarıldı.');
  });

  it('excludes deleted documents from summary count', async () => {
    prismaMock.documentFavorite.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-05-10T10:00:00.000Z'),
        document: {
          updatedAt: new Date(),
          workspaceId: 'ws-1',
        },
      },
    ]);
    prismaMock.documentFavorite.groupBy.mockResolvedValue([{ documentId: 'doc-1' }]);
    prismaMock.documentFavorite.findFirst.mockResolvedValue({
      createdAt: new Date('2026-05-10T10:00:00.000Z'),
    });

    const summary = await service.getSummary('user-1');

    expect(summary.favoriteCount).toBe(1);
    expect(summary.workspaceCount).toBe(1);
  });
});
