import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateDocumentMessageDto } from './dto/create-document-message.dto';
import { DocumentsService } from './documents.service';

export type DocumentMessageAuthorDto = {
  id: string;
  name: string;
  email: string;
};

export type DocumentMessageDto = {
  id: string;
  documentId: string;
  body: string;
  createdAt: Date;
  author: DocumentMessageAuthorDto;
  isMine: boolean;
};

type DocumentMessageRow = {
  id: string;
  documentId: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
};

const messageAuthorSelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const messageSelect = {
  id: true,
  documentId: true,
  body: true,
  createdAt: true,
  authorId: true,
  author: {
    select: messageAuthorSelect,
  },
} as const;

@Injectable()
export class DocumentMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async listDocumentMessages(
    userId: string,
    documentId: string,
  ): Promise<{ messages: DocumentMessageDto[] }> {
    await this.documentsService.assertDocumentReadAccess(userId, documentId);

    const rows = await this.prisma.documentMessage.findMany({
      where: {
        documentId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: messageSelect,
    });

    return {
      messages: rows.map((row) => this.mapDocumentMessage(row, userId)),
    };
  }

  async createDocumentMessage(
    userId: string,
    documentId: string,
    payload: CreateDocumentMessageDto,
  ): Promise<{ message: DocumentMessageDto }> {
    await this.documentsService.assertDocumentReadAccess(userId, documentId);

    const body = payload.body.trim();
    if (!body) {
      throw new BadRequestException('Message body cannot be empty.');
    }

    const created = await this.prisma.documentMessage.create({
      data: {
        documentId,
        authorId: userId,
        body,
      },
      select: messageSelect,
    });

    const message = this.mapDocumentMessage(created, userId);
    this.emitMessageCreated({ documentId, message });

    return { message };
  }

  async deleteDocumentMessage(
    userId: string,
    documentId: string,
    messageId: string,
  ): Promise<{ deleted: true }> {
    const access = await this.documentsService.assertDocumentReadAccess(
      userId,
      documentId,
    );

    const message = await this.prisma.documentMessage.findFirst({
      where: { id: messageId, documentId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    const canDelete =
      message.authorId === userId || access.permissions.canShare;
    if (!canDelete) {
      throw new ForbiddenException('You cannot delete this message.');
    }

    await this.prisma.documentMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    this.emitMessageDeleted({ documentId, messageId });

    return { deleted: true };
  }

  private mapDocumentMessage(
    row: DocumentMessageRow,
    viewerUserId: string,
  ): DocumentMessageDto {
    return {
      id: row.id,
      documentId: row.documentId,
      body: row.body,
      createdAt: row.createdAt,
      author: {
        id: row.author.id,
        name: row.author.fullName,
        email: row.author.email,
      },
      isMine: row.authorId === viewerUserId,
    };
  }

  private emitMessageCreated(event: {
    documentId: string;
    message: DocumentMessageDto;
  }): void {
    this.realtimeService.publishDocumentMessageCreated({
      documentId: event.documentId,
      message: {
        id: event.message.id,
        documentId: event.message.documentId,
        body: event.message.body,
        createdAt: event.message.createdAt.toISOString(),
        author: event.message.author,
      },
    });
  }

  private emitMessageDeleted(event: {
    documentId: string;
    messageId: string;
  }): void {
    this.realtimeService.publishDocumentMessageDeleted(event);
  }
}
