import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  DocumentRole,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddDocumentMemberDto } from './dto/add-document-member.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentCommentDto } from './dto/update-document-comment.dto';
import { BulkDocumentsTrashDto } from './dto/bulk-documents-trash.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateDocumentMemberDto } from './dto/update-document-member.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(userId: string, payload: CreateDocumentDto) {
    await this.assertWorkspaceAccess(userId, payload.workspaceId);

    const normalizedTitle = payload.title.trim();
    const slug = await this.generateUniqueSlug(
      payload.workspaceId,
      normalizedTitle,
    );

    const document = await this.prisma.$transaction(async (tx) => {
      const createdDocument = await tx.document.create({
        data: {
          title: normalizedTitle,
          slug,
          workspaceId: payload.workspaceId,
          createdById: userId,
          lastEditedById: userId,
          currentVersion: 0,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          workspaceId: true,
          createdById: true,
          lastEditedById: true,
          currentVersion: true,
          previewContent: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.documentMember.create({
        data: {
          documentId: createdDocument.id,
          userId,
          role: DocumentRole.OWNER,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: payload.workspaceId,
          documentId: createdDocument.id,
          actorId: userId,
          type: ActivityType.DOCUMENT_CREATED,
          metadata: {
            title: createdDocument.title,
            slug: createdDocument.slug,
          },
        },
      });

      return createdDocument;
    });

    return { document };
  }

  async getDocumentsSummary(userId: string) {
    const accessibleWhere = this.buildAccessibleDocumentsWhere(userId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [documents, favoriteDocuments] = await Promise.all([
      this.prisma.document.findMany({
        where: accessibleWhere,
        select: {
          id: true,
          createdById: true,
          updatedAt: true,
          members: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      }),
      this.prisma.documentFavorite.count({
        where: {
          userId,
          document: accessibleWhere,
        },
      }),
    ]);

    let ownedDocuments = 0;
    let sharedDocuments = 0;
    let recentlyUpdated = 0;

    for (const doc of documents) {
      const documentRole = doc.members[0]?.role ?? null;
      if (this.isOwnedDocument(userId, doc.createdById, documentRole)) {
        ownedDocuments += 1;
      } else {
        sharedDocuments += 1;
      }

      if (doc.updatedAt >= sevenDaysAgo) {
        recentlyUpdated += 1;
      }
    }

    return {
      totalDocuments: documents.length,
      ownedDocuments,
      sharedDocuments,
      favoriteDocuments,
      recentlyUpdated,
    };
  }

  async listAccessibleDocuments(
    userId: string,
    query: ListDocumentsQueryDto,
  ) {
    const skip = query.skip ?? 0;
    const hasListFilters = Boolean(
      query.search?.trim() ||
        query.workspaceId ||
        query.role ||
        query.sort ||
        query.view,
    );
    const take = query.take ?? (hasListFilters ? 500 : 20);

    const documentWhere: Prisma.DocumentWhereInput = {
      ...this.buildAccessibleDocumentsWhere(userId),
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

    const documents = await this.prisma.document.findMany({
      where: documentWhere,
      select: {
        id: true,
        title: true,
        slug: true,
        workspaceId: true,
        previewContent: true,
        createdAt: true,
        updatedAt: true,
        currentVersion: true,
        createdById: true,
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
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });

    const favoriteIds = await this.getFavoriteIds(
      userId,
      documents.map((doc) => doc.id),
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let mapped = documents.map((doc) =>
      this.mapAccessibleDocumentRow(userId, doc, favoriteIds),
    );

    if (query.view === 'owned') {
      mapped = mapped.filter((doc) => !doc.isShared);
    } else if (query.view === 'shared') {
      mapped = mapped.filter((doc) => doc.isShared);
    } else if (query.view === 'recent') {
      mapped = mapped.filter(
        (doc) => new Date(doc.updatedAt) >= sevenDaysAgo,
      );
    } else if (query.view === 'favorites') {
      mapped = mapped.filter((doc) => doc.isFavorite);
    }

    if (query.role) {
      mapped = mapped.filter((doc) => doc.role === query.role);
    }

    mapped = this.sortDocumentListItems(mapped, query.sort);

    const page = mapped.slice(skip, skip + take);

    return { documents: page };
  }

  async assertDocumentExportAccess(userId: string, documentId: string): Promise<string> {
    return (await this.assertDocumentReadAccess(userId, documentId)).documentTitle;
  }

  async softDeleteDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        deletedAt: true,
        createdById: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
        workspace: {
          select: {
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    if (document.deletedAt) {
      throw new BadRequestException('Doküman zaten çöp kutusunda.');
    }

    const documentRole = document.members[0]?.role ?? null;
    const workspaceRole = document.workspace.members[0]?.role ?? null;
    const canDelete =
      document.createdById === userId ||
      documentRole === DocumentRole.OWNER ||
      workspaceRole === WorkspaceRole.OWNER;

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this document.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          deletedAt: new Date(),
          deletedById: userId,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: document.workspaceId,
          documentId: document.id,
          actorId: userId,
          type: ActivityType.DOCUMENT_UPDATED,
          metadata: {
            action: 'moved_to_trash',
            title: document.title,
          },
        },
      });
    });

    return { message: 'Doküman çöp kutusuna taşındı.' };
  }

  async bulkMoveToTrash(userId: string, payload: BulkDocumentsTrashDto) {
    let movedCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; message: string }> = [];

    for (const documentId of payload.documentIds) {
      try {
        await this.softDeleteDocument(userId, documentId);
        movedCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push({
          id: documentId,
          message: this.resolveErrorMessage(error),
        });
      }
    }

    return {
      movedCount,
      failedCount,
      ...(failures.length > 0 ? { failures } : {}),
    };
  }

  async updateDocument(
    userId: string,
    documentId: string,
    payload: UpdateDocumentDto,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        deletedAt: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    if (document.deletedAt) {
      throw new GoneException('Bu doküman çöp kutusunda.');
    }

    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access?.permissions.canEdit) {
      throw new ForbiddenException(
        'Bu dokümanın başlığını değiştirme yetkiniz yok.',
      );
    }

    const normalizedTitle = payload.title.trim();
    if (normalizedTitle.length < 2) {
      throw new BadRequestException('Başlık en az 2 karakter olmalıdır.');
    }

    const slug = await this.generateUniqueSlug(
      document.workspaceId,
      normalizedTitle,
    );

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        title: normalizedTitle,
        slug,
        lastEditedById: userId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: document.workspaceId,
        documentId: document.id,
        actorId: userId,
        type: ActivityType.DOCUMENT_UPDATED,
        metadata: {
          action: 'title_renamed',
          previousTitle: document.title,
          title: normalizedTitle,
        },
      },
    });

    return { document: updated };
  }

  async assertDocumentReadAccess(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, deletedAt: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    if (document.deletedAt) {
      throw new GoneException('Bu doküman çöp kutusunda.');
    }
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    return {
      documentId: document.id,
      documentTitle: document.title,
      ...access,
    };
  }

  async getDocumentById(userId: string, documentId: string) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        slug: true,
        workspaceId: true,
        previewContent: true,
        currentVersion: true,
        createdById: true,
        lastEditedById: true,
        createdAt: true,
        updatedAt: true,
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    return {
      document: {
        ...document,
        currentUserRole: access.currentUserRole,
        permissions: access.permissions,
      },
    };
  }

  async listDocumentMembers(userId: string, documentId: string) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const members = await this.prisma.documentMember.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      members: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: member.user.fullName,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        createdAt: member.createdAt,
      })),
    };
  }

  async addDocumentMember(
    actorUserId: string,
    documentId: string,
    payload: AddDocumentMemberDto,
  ) {
    const access = await this.getDocumentAccessContext(actorUserId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }
    if (!access.permissions.canShare) {
      throw new ForbiddenException(
        'Only document owners or workspace owners/admins can share this document.',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundException(
        'No active user is registered with this email address.',
      );
    }

    const workspaceMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: access.workspaceId,
          userId: targetUser.id,
        },
      },
      select: { id: true },
    });

    if (!workspaceMembership) {
      throw new BadRequestException("Kullanıcı önce workspace'e eklenmelidir.");
    }

    const existingMembership = await this.prisma.documentMember.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId: targetUser.id,
        },
      },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException('This user is already a member of this document.');
    }

    const membership = await this.prisma.documentMember.create({
      data: {
        documentId,
        userId: targetUser.id,
        role: payload.role,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      member: {
        id: membership.id,
        userId: membership.userId,
        fullName: membership.user.fullName,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl,
        role: membership.role,
        createdAt: membership.createdAt,
      },
    };
  }

  async updateDocumentMemberRole(
    actorUserId: string,
    documentId: string,
    memberId: string,
    payload: UpdateDocumentMemberDto,
  ) {
    const access = await this.getDocumentAccessContext(actorUserId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }
    if (!access.permissions.canShare) {
      throw new ForbiddenException(
        'Only document owners or workspace owners/admins can manage members.',
      );
    }

    const member = await this.prisma.documentMember.findFirst({
      where: { id: memberId, documentId },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found for this document.');
    }

    if (member.role === DocumentRole.OWNER) {
      throw new BadRequestException('Owner role cannot be changed.');
    }

    const updated = await this.prisma.documentMember.update({
      where: { id: memberId },
      data: { role: payload.role },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      member: {
        id: updated.id,
        userId: updated.userId,
        fullName: updated.user.fullName,
        email: updated.user.email,
        avatarUrl: updated.user.avatarUrl,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    };
  }

  async removeDocumentMember(
    actorUserId: string,
    documentId: string,
    memberId: string,
  ) {
    const access = await this.getDocumentAccessContext(actorUserId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }
    if (!access.permissions.canShare) {
      throw new ForbiddenException(
        'Only document owners or workspace owners/admins can manage members.',
      );
    }

    const member = await this.prisma.documentMember.findFirst({
      where: { id: memberId, documentId },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found for this document.');
    }

    if (member.role === DocumentRole.OWNER) {
      if (member.userId === actorUserId) {
        throw new BadRequestException('Owner cannot remove themselves.');
      }
      throw new BadRequestException('Owner cannot be removed from the document.');
    }

    await this.prisma.documentMember.delete({
      where: { id: memberId },
    });

    return { deleted: true };
  }

  async listDocumentComments(userId: string, documentId: string) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const rows = await this.prisma.documentComment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        documentId: true,
        body: true,
        selectedText: true,
        anchorOffset: true,
        focusOffset: true,
        isResolved: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      comments: rows.map((row) => this.mapDocumentComment(row)),
    };
  }

  async createDocumentComment(
    userId: string,
    documentId: string,
    payload: CreateDocumentCommentDto,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const body = payload.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body cannot be empty.');
    }

    const selectedText =
      payload.selectedText && payload.selectedText.length > 0
        ? payload.selectedText.trim()
        : null;

    const created = await this.prisma.documentComment.create({
      data: {
        documentId,
        authorId: userId,
        body,
        selectedText,
        anchorOffset: payload.anchorOffset ?? null,
        focusOffset: payload.focusOffset ?? null,
      },
      select: {
        id: true,
        documentId: true,
        body: true,
        selectedText: true,
        anchorOffset: true,
        focusOffset: true,
        isResolved: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return { comment: this.mapDocumentComment(created) };
  }

  async resolveDocumentComment(
    userId: string,
    documentId: string,
    commentId: string,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const comment = await this.prisma.documentComment.findFirst({
      where: { id: commentId, documentId },
      select: {
        id: true,
        authorId: true,
        isResolved: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const canResolve =
      access.permissions.canEdit || comment.authorId === userId;
    if (!canResolve) {
      throw new ForbiddenException('You cannot resolve this comment.');
    }

    if (comment.isResolved) {
      const existing = await this.prisma.documentComment.findUniqueOrThrow({
        where: { id: commentId },
        select: {
          id: true,
          documentId: true,
          body: true,
          selectedText: true,
          anchorOffset: true,
          focusOffset: true,
          isResolved: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });
      return { comment: this.mapDocumentComment(existing) };
    }

    const updated = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
      select: {
        id: true,
        documentId: true,
        body: true,
        selectedText: true,
        anchorOffset: true,
        focusOffset: true,
        isResolved: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return { comment: this.mapDocumentComment(updated) };
  }

  async deleteDocumentComment(
    userId: string,
    documentId: string,
    commentId: string,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const comment = await this.prisma.documentComment.findFirst({
      where: { id: commentId, documentId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const canDelete =
      access.permissions.canEdit || comment.authorId === userId;
    if (!canDelete) {
      throw new ForbiddenException('You cannot delete this comment.');
    }

    await this.prisma.documentComment.delete({
      where: { id: commentId },
    });

    return { deleted: true };
  }

  async updateDocumentComment(
    userId: string,
    documentId: string,
    commentId: string,
    payload: UpdateDocumentCommentDto,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const comment = await this.prisma.documentComment.findFirst({
      where: { id: commentId, documentId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const canUpdate =
      access.permissions.canEdit || comment.authorId === userId;
    if (!canUpdate) {
      throw new ForbiddenException('You cannot edit this comment.');
    }

    const body = payload.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body cannot be empty.');
    }

    const updated = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: {
        body,
      },
      select: {
        id: true,
        documentId: true,
        body: true,
        selectedText: true,
        anchorOffset: true,
        focusOffset: true,
        isResolved: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return { comment: this.mapDocumentComment(updated) };
  }

  private mapDocumentComment(row: {
    id: string;
    documentId: string;
    body: string;
    selectedText: string | null;
    anchorOffset: number | null;
    focusOffset: number | null;
    isResolved: boolean;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
    };
    resolvedBy: {
      id: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  }) {
    return {
      id: row.id,
      documentId: row.documentId,
      body: row.body,
      selectedText: row.selectedText,
      anchorOffset: row.anchorOffset,
      focusOffset: row.focusOffset,
      isResolved: row.isResolved,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        id: row.author.id,
        fullName: row.author.fullName,
        email: row.author.email,
        avatarUrl: row.author.avatarUrl,
      },
      resolvedBy: row.resolvedBy
        ? {
            id: row.resolvedBy.id,
            fullName: row.resolvedBy.fullName,
            email: row.resolvedBy.email,
            avatarUrl: row.resolvedBy.avatarUrl,
          }
        : null,
    };
  }

  private buildAccessibleDocumentsWhere(
    userId: string,
  ): Prisma.DocumentWhereInput {
    return {
      deletedAt: null,
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

  private isOwnedDocument(
    userId: string,
    createdById: string,
    documentRole: DocumentRole | null,
  ): boolean {
    return documentRole === DocumentRole.OWNER || createdById === userId;
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

  private mapAccessibleDocumentRow(
    userId: string,
    doc: {
      id: string;
      title: string;
      slug: string;
      workspaceId: string;
      previewContent: unknown;
      createdAt: Date;
      updatedAt: Date;
      currentVersion: number;
      createdById: string;
      workspace: {
        name: string;
        members: Array<{ role: WorkspaceRole }>;
      };
      createdBy: { id: string; fullName: string; email: string };
      members: Array<{
        userId: string;
        role: DocumentRole;
        user: { id: string; fullName: string; email: string };
      }>;
      _count: { members: number };
    },
    favoriteIds: Set<string>,
  ) {
    const membership = doc.members.find((member) => member.userId === userId);
    const documentRole = membership?.role ?? null;
    const workspaceRole = doc.workspace.members[0]?.role ?? null;
    const isWorkspaceAdmin =
      workspaceRole === WorkspaceRole.OWNER ||
      workspaceRole === WorkspaceRole.ADMIN;
    const isOwned = this.isOwnedDocument(userId, doc.createdById, documentRole);
    const role = documentRole ?? (isWorkspaceAdmin ? DocumentRole.OWNER : null);

    const ownerMember = doc.members.find(
      (member) => member.role === DocumentRole.OWNER,
    );
    const owner = ownerMember
      ? {
          id: ownerMember.user.id,
          name: ownerMember.user.fullName?.trim() || 'Bilinmiyor',
          email: ownerMember.user.email,
        }
      : {
          id: doc.createdBy.id,
          name: doc.createdBy.fullName?.trim() || 'Bilinmiyor',
          email: doc.createdBy.email,
        };

    const canEdit =
      documentRole === DocumentRole.OWNER ||
      documentRole === DocumentRole.EDITOR ||
      isWorkspaceAdmin;
    const canShare = documentRole === DocumentRole.OWNER || isWorkspaceAdmin;
    const canDelete =
      doc.createdById === userId ||
      documentRole === DocumentRole.OWNER ||
      workspaceRole === WorkspaceRole.OWNER;

    return {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      workspaceId: doc.workspaceId,
      workspaceName: doc.workspace.name,
      previewContent: doc.previewContent,
      role: role ?? DocumentRole.VIEWER,
      owner,
      memberCount: doc._count.members,
      updatedAt: doc.updatedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      currentVersion: doc.currentVersion,
      isFavorite: favoriteIds.has(doc.id),
      isShared: !isOwned,
      canEdit,
      canShare,
      canDelete,
    };
  }

  private sortDocumentListItems<
    T extends { title: string; updatedAt: string; createdAt: string; isFavorite: boolean },
  >(
    items: T[],
    sort: ListDocumentsQueryDto['sort'],
  ): T[] {
    const sorted = [...items];

    switch (sort) {
      case 'created':
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
        break;
      case 'favorite':
        sorted.sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
          }
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        break;
      case 'updated':
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        break;
    }

    return sorted;
  }

  private async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Bu workspace için erişim yetkiniz yok.');
    }
  }

  private async getDocumentAccessContext(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        deletedAt: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
        workspace: {
          select: {
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    if (document.deletedAt) {
      return null;
    }

    const documentRole = document.members[0]?.role ?? null;
    const workspaceRole = document.workspace.members[0]?.role ?? null;
    const isWorkspaceAdmin =
      workspaceRole === WorkspaceRole.OWNER || workspaceRole === WorkspaceRole.ADMIN;
    const canRead = Boolean(documentRole) || isWorkspaceAdmin;
    const canEdit =
      documentRole === DocumentRole.OWNER ||
      documentRole === DocumentRole.EDITOR ||
      isWorkspaceAdmin;
    const canShare = documentRole === DocumentRole.OWNER || isWorkspaceAdmin;

    return {
      workspaceId: document.workspaceId,
      currentUserRole: documentRole ?? workspaceRole,
      permissions: {
        canRead,
        canEdit,
        canShare,
      },
    };
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(', ') : message;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'İşlem başarısız.';
  }

  private slugifyTitle(title: string) {
    const baseSlug = title
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9ğüşöçıİI\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return baseSlug || 'untitled-document';
  }

  private async generateUniqueSlug(workspaceId: string, title: string) {
    const baseSlug = this.slugifyTitle(title);

    let suffix = 1;
    let candidate = baseSlug;

    while (
      await this.prisma.document.findFirst({
        where: {
          workspaceId,
          slug: candidate,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      })
    ) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}
