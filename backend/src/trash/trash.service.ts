import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, DocumentRole, Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkTrashActionDto } from './dto/bulk-trash-action.dto';
import { ListTrashDocumentsQueryDto } from './dto/list-trash-documents-query.dto';

const RETENTION_POLICY_DAYS = 30;

type TrashDocumentRow = {
  id: string;
  title: string;
  workspaceId: string;
  updatedAt: Date;
  deletedAt: Date;
  workspace: { name: string };
  deletedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  _count: { members: number };
};

type ManagedDeletedDocument = {
  id: string;
  deletedAt: Date | null;
  title: string;
  workspaceId: string;
};

type BulkFailure = { id: string; message: string };

@Injectable()
export class TrashService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const where = this.trashableDocumentsWhere(userId);
    const [deletedDocumentCount, oldest] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findFirst({
        where,
        orderBy: { deletedAt: 'asc' },
        select: { deletedAt: true },
      }),
    ]);

    return {
      deletedDocumentCount,
      restorableCount: deletedDocumentCount,
      oldestDeletedAt: oldest?.deletedAt?.toISOString() ?? null,
      retentionPolicyDays: RETENTION_POLICY_DAYS,
    };
  }

  async listDocuments(userId: string, query: ListTrashDocumentsQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      ...this.trashableDocumentsWhere(userId),
    };

    if (query.workspaceId) {
      where.workspaceId = query.workspaceId;
    }

    if (query.search?.trim()) {
      where.title = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const orderBy = this.resolveSort(query.sort);

    const rows = await this.prisma.document.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        workspaceId: true,
        updatedAt: true,
        deletedAt: true,
        workspace: { select: { name: true } },
        deletedBy: {
          select: { id: true, fullName: true, email: true },
        },
        _count: { select: { members: true } },
      },
    });

    return {
      documents: rows
        .filter((row): row is TrashDocumentRow => row.deletedAt !== null)
        .map((row) => this.buildTrashDocumentDto(row)),
    };
  }

  async restoreDocument(userId: string, documentId: string) {
    const document = await this.assertCanManageDeletedDocument(userId, documentId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const restored = await tx.document.update({
        where: { id: document.id },
        data: {
          deletedAt: null,
          deletedById: null,
          updatedAt: new Date(),
        },
        select: { id: true, title: true },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: document.workspaceId,
          documentId: document.id,
          actorId: userId,
          type: ActivityType.DOCUMENT_UPDATED,
          metadata: {
            action: 'restored',
            title: document.title,
          },
        },
      });

      return restored;
    });

    return {
      message: 'Doküman geri yüklendi.',
      document: updated,
    };
  }

  async permanentDeleteDocument(userId: string, documentId: string) {
    const document = await this.assertCanManageDeletedDocument(userId, documentId);

    await this.prisma.$transaction(async (tx) => {
      await tx.activityLog.create({
        data: {
          workspaceId: document.workspaceId,
          documentId: document.id,
          actorId: userId,
          type: ActivityType.DOCUMENT_UPDATED,
          metadata: {
            action: 'permanently_deleted',
            title: document.title,
          },
        },
      });

      await tx.documentMessage.deleteMany({
        where: { documentId: document.id },
      });
      await tx.documentComment.deleteMany({
        where: { documentId: document.id },
      });
      await tx.documentUpdate.deleteMany({
        where: { documentId: document.id },
      });
      await tx.documentSnapshot.deleteMany({
        where: { documentId: document.id },
      });
      await tx.documentMember.deleteMany({
        where: { documentId: document.id },
      });
      await tx.mediaFile.deleteMany({
        where: { documentId: document.id },
      });
      await tx.document.delete({
        where: { id: document.id },
      });
    });

    return { message: 'Doküman kalıcı olarak silindi.' };
  }

  async bulkRestore(userId: string, payload: BulkTrashActionDto) {
    let restoredCount = 0;
    let failedCount = 0;
    const failures: BulkFailure[] = [];

    for (const documentId of payload.documentIds) {
      try {
        await this.restoreDocument(userId, documentId);
        restoredCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push({
          id: documentId,
          message: this.resolveErrorMessage(error),
        });
      }
    }

    return this.buildBulkResult({ restoredCount, failedCount, failures });
  }

  async bulkPermanentDelete(userId: string, payload: BulkTrashActionDto) {
    let deletedCount = 0;
    let failedCount = 0;
    const failures: BulkFailure[] = [];

    for (const documentId of payload.documentIds) {
      try {
        await this.permanentDeleteDocument(userId, documentId);
        deletedCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push({
          id: documentId,
          message: this.resolveErrorMessage(error),
        });
      }
    }

    return this.buildBulkResult({ deletedCount, failedCount, failures });
  }

  private trashableDocumentsWhere(userId: string): Prisma.DocumentWhereInput {
    return {
      deletedAt: { not: null },
      OR: [
        { createdById: userId },
        {
          members: {
            some: { userId, role: DocumentRole.OWNER },
          },
        },
        {
          workspace: {
            members: {
              some: { userId, role: WorkspaceRole.OWNER },
            },
          },
        },
      ],
    };
  }

  private async assertCanManageDeletedDocument(
    userId: string,
    documentId: string,
  ): Promise<ManagedDeletedDocument> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        ...this.trashableDocumentsWhere(userId),
      },
      select: {
        id: true,
        deletedAt: true,
        title: true,
        workspaceId: true,
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

      if (!exists.deletedAt) {
        throw new BadRequestException('Doküman çöp kutusunda değil.');
      }

      throw new ForbiddenException(
        'You do not have permission to manage this document.',
      );
    }

    return document;
  }

  private buildTrashDocumentDto(row: TrashDocumentRow) {
    const deletedAt = row.deletedAt;
    const { daysSinceDeleted, daysUntilPolicyLimit } =
      this.calculateRetention(deletedAt);

    return {
      id: row.id,
      title: row.title,
      workspaceId: row.workspaceId,
      workspaceName: row.workspace.name,
      deletedAt: deletedAt.toISOString(),
      deletedBy: row.deletedBy
        ? {
            id: row.deletedBy.id,
            name: row.deletedBy.fullName,
            email: row.deletedBy.email,
          }
        : null,
      lastUpdatedAt: row.updatedAt.toISOString(),
      memberCount: row._count.members,
      daysSinceDeleted,
      daysUntilPolicyLimit,
    };
  }

  private calculateRetention(deletedAt: Date) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceDeleted = Math.max(
      0,
      Math.floor((Date.now() - deletedAt.getTime()) / msPerDay),
    );
    const daysUntilPolicyLimit = Math.max(
      0,
      RETENTION_POLICY_DAYS - daysSinceDeleted,
    );

    return { daysSinceDeleted, daysUntilPolicyLimit };
  }

  private resolveSort(
    sort: ListTrashDocumentsQueryDto['sort'],
  ): Prisma.DocumentOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { deletedAt: 'asc' };
      case 'title':
        return { title: 'asc' };
      case 'newest':
      default:
        return { deletedAt: 'desc' };
    }
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      return error.message;
    }
    if (error instanceof ForbiddenException) {
      return error.message;
    }
    if (error instanceof NotFoundException) {
      return error.message;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'İşlem başarısız.';
  }

  private buildBulkResult(params: {
    restoredCount?: number;
    deletedCount?: number;
    failedCount: number;
    failures: BulkFailure[];
  }) {
    return {
      ...(params.restoredCount !== undefined
        ? { restoredCount: params.restoredCount }
        : {}),
      ...(params.deletedCount !== undefined
        ? { deletedCount: params.deletedCount }
        : {}),
      failedCount: params.failedCount,
      ...(params.failures.length > 0 ? { failures: params.failures } : {}),
    };
  }
}
