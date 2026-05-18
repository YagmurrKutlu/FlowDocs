import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRole, Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListSharedByMeQueryDto } from './dto/list-shared-by-me-query.dto';
import { ListSharedWithMeQueryDto } from './dto/list-shared-with-me-query.dto';

type WithMeMembershipRow = {
  createdAt: Date;
  role: DocumentRole;
  document: {
    id: string;
    title: string;
    workspaceId: string;
    previewContent: unknown;
    updatedAt: Date;
    createdAt: Date;
    createdBy: {
      id: string;
      fullName: string;
      email: string;
    };
    workspace: { name: string };
    members: Array<{
      role: DocumentRole;
      createdAt: Date;
      user: { id: string; fullName: string; email: string };
    }>;
    _count: { members: number };
  };
};

type ByMeDocumentRow = {
  id: string;
  title: string;
  workspaceId: string;
  previewContent: unknown;
  updatedAt: Date;
  createdAt: Date;
  workspace: { name: string };
  members: Array<{ userId: string; role: DocumentRole }>;
};

@Injectable()
export class SharedService {
  constructor(private readonly prisma: PrismaService) {}

  async listWithMe(userId: string, query: ListSharedWithMeQueryDto) {
    const documentWhere: Prisma.DocumentWhereInput = {
      deletedAt: null,
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

    const membershipWhere: Prisma.DocumentMemberWhereInput = {
      userId,
      document: documentWhere,
      role: query.role ?? { not: DocumentRole.OWNER },
    };

    const orderBy = this.resolveWithMeSort(query.sort);

    const rows = await this.prisma.documentMember.findMany({
      where: membershipWhere,
      orderBy,
      select: {
        createdAt: true,
        role: true,
        document: {
          select: {
            id: true,
            title: true,
            workspaceId: true,
            previewContent: true,
            updatedAt: true,
            createdAt: true,
            createdBy: {
              select: { id: true, fullName: true, email: true },
            },
            workspace: { select: { name: true } },
            members: {
              where: { role: DocumentRole.OWNER },
              take: 1,
              select: {
                role: true,
                createdAt: true,
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });

    const favoriteIds = await this.getFavoriteIds(
      userId,
      rows.map((row) => row.document.id),
    );

    return {
      documents: rows.map((row) =>
        this.mapWithMeRow(row as WithMeMembershipRow, favoriteIds),
      ),
    };
  }

  async listByMe(userId: string, query: ListSharedByMeQueryDto) {
    const documentWhere: Prisma.DocumentWhereInput = {
      deletedAt: null,
      members: {
        some: {
          userId,
          role: DocumentRole.OWNER,
        },
      },
      AND: [
        {
          members: {
            some: {
              userId: { not: userId },
            },
          },
        },
      ],
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

    const orderBy = this.resolveByMeSort(query.sort);

    const documents = await this.prisma.document.findMany({
      where: documentWhere,
      orderBy,
      select: {
        id: true,
        title: true,
        workspaceId: true,
        previewContent: true,
        updatedAt: true,
        createdAt: true,
        workspace: { select: { name: true } },
        members: {
          select: { userId: true, role: true },
        },
      },
    });

    const favoriteIds = await this.getFavoriteIds(
      userId,
      documents.map((doc) => doc.id),
    );

    return {
      documents: documents.map((doc) =>
        this.mapByMeRow(doc as ByMeDocumentRow, userId, favoriteIds),
      ),
    };
  }

  async leaveWithMe(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        deletedAt: true,
        createdById: true,
        workspaceId: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    if (document.deletedAt) {
      throw new GoneException('Document is in trash.');
    }

    const membership = await this.prisma.documentMember.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      const workspaceMembership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: document.workspaceId,
            userId,
          },
        },
        select: { role: true },
      });

      const hasWorkspaceAccess =
        workspaceMembership?.role === WorkspaceRole.OWNER ||
        workspaceMembership?.role === WorkspaceRole.ADMIN;

      if (hasWorkspaceAccess) {
        throw new ConflictException(
          'Bu dokümana erişiminiz çalışma alanı üyeliğinizden geliyor.',
        );
      }

      return { message: 'Erişim zaten kaldırılmış.' };
    }

    if (membership.role === DocumentRole.OWNER) {
      if (document.createdById === userId) {
        throw new BadRequestException(
          'Sahibi olduğunuz dokümandan ayrılamazsınız.',
        );
      }

      const ownerCount = await this.prisma.documentMember.count({
        where: { documentId, role: DocumentRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Son owner dokümandan ayrılamaz.');
      }
    }

    await this.prisma.documentMember.delete({
      where: { id: membership.id },
    });

    return { message: 'Doküman erişiminiz kaldırıldı.' };
  }

  async getSummary(userId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [withMeMemberships, byMeDocuments] = await Promise.all([
      this.prisma.documentMember.findMany({
        where: {
          userId,
          role: { not: DocumentRole.OWNER },
          document: { deletedAt: null },
        },
        select: {
          role: true,
          document: {
            select: {
              workspaceId: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.document.findMany({
        where: {
          deletedAt: null,
          members: {
            some: { userId, role: DocumentRole.OWNER },
          },
          AND: [
            {
              members: {
                some: { userId: { not: userId } },
              },
            },
          ],
        },
        select: {
          workspaceId: true,
          updatedAt: true,
        },
      }),
    ]);

    const workspaceIds = new Set<string>();
    for (const row of withMeMemberships) {
      workspaceIds.add(row.document.workspaceId);
    }
    for (const doc of byMeDocuments) {
      workspaceIds.add(doc.workspaceId);
    }

    const editorAccessCount = withMeMemberships.filter(
      (row) => row.role === DocumentRole.EDITOR,
    ).length;

    const viewerAccessCount = withMeMemberships.filter(
      (row) => row.role === DocumentRole.VIEWER,
    ).length;

    const recentlyUpdatedCount = [
      ...withMeMemberships.map((row) => row.document.updatedAt),
      ...byMeDocuments.map((doc) => doc.updatedAt),
    ].filter((updatedAt) => updatedAt >= sevenDaysAgo).length;

    return {
      withMeCount: withMeMemberships.length,
      byMeCount: byMeDocuments.length,
      editorAccessCount,
      viewerAccessCount,
      workspaceCount: workspaceIds.size,
      recentlyUpdatedCount,
    };
  }

  private async getFavoriteIds(
    userId: string,
    documentIds: string[],
  ): Promise<Set<string>> {
    if (documentIds.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.documentFavorite.findMany({
      where: {
        userId,
        documentId: { in: documentIds },
      },
      select: { documentId: true },
    });

    return new Set(rows.map((row) => row.documentId));
  }

  private mapWithMeRow(
    row: WithMeMembershipRow,
    favoriteIds: Set<string>,
  ) {
    const ownerMember = row.document.members[0];
    const owner = ownerMember
      ? {
          id: ownerMember.user.id,
          name: ownerMember.user.fullName?.trim() || 'Bilinmiyor',
          email: ownerMember.user.email,
        }
      : {
          id: row.document.createdBy.id,
          name: row.document.createdBy.fullName?.trim() || 'Bilinmiyor',
          email: row.document.createdBy.email,
        };

    return {
      id: row.document.id,
      title: row.document.title,
      workspaceId: row.document.workspaceId,
      workspaceName: row.document.workspace.name,
      owner,
      myRole: row.role,
      memberCount: row.document._count.members,
      updatedAt: row.document.updatedAt.toISOString(),
      sharedAt: row.createdAt.toISOString(),
      previewContent: row.document.previewContent,
      isFavorite: favoriteIds.has(row.document.id),
    };
  }

  private mapByMeRow(
    doc: ByMeDocumentRow,
    userId: string,
    favoriteIds: Set<string>,
  ) {
    const others = doc.members.filter((member) => member.userId !== userId);
    const editorCount = others.filter(
      (member) => member.role === DocumentRole.EDITOR,
    ).length;
    const viewerCount = others.filter(
      (member) => member.role === DocumentRole.VIEWER,
    ).length;

    return {
      id: doc.id,
      title: doc.title,
      workspaceId: doc.workspaceId,
      workspaceName: doc.workspace.name,
      sharedUserCount: others.length,
      editorCount,
      viewerCount,
      updatedAt: doc.updatedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      previewContent: doc.previewContent,
      isFavorite: favoriteIds.has(doc.id),
    };
  }

  private resolveWithMeSort(
    sort: ListSharedWithMeQueryDto['sort'],
  ): Prisma.DocumentMemberOrderByWithRelationInput {
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

  private resolveByMeSort(
    sort: ListSharedByMeQueryDto['sort'],
  ): Prisma.DocumentOrderByWithRelationInput {
    switch (sort) {
      case 'title':
        return { title: 'asc' };
      case 'recent':
        return { createdAt: 'desc' };
      case 'updated':
      default:
        return { updatedAt: 'desc' };
    }
  }
}
