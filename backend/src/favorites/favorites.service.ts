import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRole, Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async listFavorites(userId: string, query: ListFavoritesQueryDto) {
    const documentWhere: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...this.accessibleDocumentWhere(userId),
    };

    if (query.workspaceId) {
      documentWhere.workspaceId = query.workspaceId;
    }

    if (query.search?.trim()) {
      documentWhere.title = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const orderBy = this.resolveSort(query.sort);

    const rows = await this.prisma.documentFavorite.findMany({
      where: {
        userId,
        document: documentWhere,
      },
      orderBy,
      select: {
        id: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            title: true,
            workspaceId: true,
            previewContent: true,
            updatedAt: true,
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
            workspace: {
              select: {
                name: true,
                members: {
                  where: { userId },
                  select: { role: true },
                  take: 1,
                },
              },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });

    return {
      favorites: rows.map((row) => this.mapFavoriteRow(row)),
    };
  }

  async getSummary(userId: string) {
    const baseWhere: Prisma.DocumentFavoriteWhereInput = {
      userId,
      document: {
        deletedAt: null,
        ...this.accessibleDocumentWhere(userId),
      },
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [favorites, latest] = await Promise.all([
      this.prisma.documentFavorite.findMany({
        where: baseWhere,
        select: {
          createdAt: true,
          document: {
            select: {
              updatedAt: true,
              workspaceId: true,
            },
          },
        },
      }),
      this.prisma.documentFavorite.findFirst({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const workspaceIds = new Set(
      favorites.map((f) => f.document.workspaceId),
    );

    const recentlyUpdatedCount = favorites.filter(
      (f) => f.document.updatedAt >= sevenDaysAgo,
    ).length;

    return {
      favoriteCount: favorites.length,
      workspaceCount: workspaceIds.size,
      latestFavoritedAt: latest?.createdAt.toISOString() ?? null,
      recentlyUpdatedCount,
    };
  }

  async addFavorite(userId: string, documentId: string) {
    const document = await this.getReadableDocument(userId, documentId);

    if (document.deletedAt) {
      throw new GoneException(
        'Çöp kutusundaki doküman favorilere eklenemez.',
      );
    }

    const existing = await this.prisma.documentFavorite.findUnique({
      where: {
        userId_documentId: { userId, documentId },
      },
    });

    if (existing) {
      return { message: 'Doküman zaten favorilerde.' };
    }

    await this.prisma.documentFavorite.create({
      data: { userId, documentId },
    });

    return { message: 'Doküman favorilere eklendi.' };
  }

  async removeFavorite(userId: string, documentId: string) {
    await this.prisma.documentFavorite.deleteMany({
      where: { userId, documentId },
    });

    return { message: 'Doküman favorilerden çıkarıldı.' };
  }

  private accessibleDocumentWhere(userId: string): Prisma.DocumentWhereInput {
    return {
      OR: [
        {
          workspace: {
            members: {
              some: {
                userId,
                role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
              },
            },
          },
        },
        {
          members: {
            some: { userId },
          },
        },
      ],
    };
  }

  private async getReadableDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        ...this.accessibleDocumentWhere(userId),
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!document) {
      const exists = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, deletedAt: true },
      });

      if (!exists) {
        throw new NotFoundException('Document not found.');
      }

      if (exists.deletedAt) {
        throw new GoneException(
          'Çöp kutusundaki doküman favorilere eklenemez.',
        );
      }

      throw new ForbiddenException(
        'You do not have permission to access this document.',
      );
    }

    return document;
  }

  private mapFavoriteRow(row: {
    id: string;
    createdAt: Date;
    document: {
      id: string;
      title: string;
      workspaceId: string;
      previewContent: unknown;
      updatedAt: Date;
      members: { role: DocumentRole }[];
      workspace: {
        name: string;
        members: { role: WorkspaceRole }[];
      };
      _count: { members: number };
    };
  }) {
    const documentRole = row.document.members[0]?.role ?? null;
    const workspaceRole = row.document.workspace.members[0]?.role ?? null;
    const role = documentRole ?? workspaceRole ?? 'VIEWER';

    return {
      id: row.document.id,
      favoriteId: row.id,
      title: row.document.title,
      workspaceId: row.document.workspaceId,
      workspaceName: row.document.workspace.name,
      role,
      previewContent: row.document.previewContent,
      updatedAt: row.document.updatedAt.toISOString(),
      favoritedAt: row.createdAt.toISOString(),
      memberCount: row.document._count.members,
      isFavorite: true as const,
    };
  }

  private resolveSort(
    sort: ListFavoritesQueryDto['sort'],
  ): Prisma.DocumentFavoriteOrderByWithRelationInput {
    switch (sort) {
      case 'updated':
        return { document: { updatedAt: 'desc' } };
      case 'title':
        return { document: { title: 'asc' } };
      case 'recent':
      default:
        return { createdAt: 'desc' };
    }
  }
}
