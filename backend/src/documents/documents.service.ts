import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, DocumentRole, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddDocumentMemberDto } from './dto/add-document-member.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentCommentDto } from './dto/update-document-comment.dto';
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

  async listAccessibleDocuments(
    userId: string,
    query: ListDocumentsQueryDto,
  ) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const documents = await this.prisma.document.findMany({
      where: {
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
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        workspaceId: true,
        updatedAt: true,
        currentVersion: true,
      },
    });

    return { documents };
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
