import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { DocumentRole, WorkspaceRole } from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmDocumentMediaDto } from './dto/confirm-document-media.dto';
import { PresignDocumentMediaDto } from './dto/presign-document-media.dto';

@Injectable()
export class MediaService {
  private readonly minioClient: MinioClient;
  private readonly maxImageSizeBytes = 5 * 1024 * 1024;
  private readonly maxDocumentSizeBytes = 20 * 1024 * 1024;
  private readonly imageMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);
  private readonly documentMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {
    this.minioClient = new MinioClient({
      endPoint: appConfig.storage.endpoint,
      port: appConfig.storage.port,
      useSSL: appConfig.storage.useSsl,
      accessKey: appConfig.storage.accessKey,
      secretKey: appConfig.storage.secretKey,
    });
  }

  async createDocumentMediaPresign(
    userId: string,
    documentId: string,
    payload: PresignDocumentMediaDto,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }
    if (!access.permissions.canEdit) {
      throw new ForbiddenException('Bu dokumana medya yukleyemezsiniz.');
    }

    this.validateMediaInput(payload.contentType, payload.size);
    await this.ensureBucketExists();

    const ext = this.safeExtension(payload.fileName, payload.contentType);
    const objectKey = `documents/${documentId}/${userId}/${Date.now()}-${randomUUID()}${ext}`;
    const uploadUrl = await this.minioClient.presignedPutObject(
      this.appConfig.storage.bucket,
      objectKey,
      60 * 10,
    );

    return {
      uploadUrl,
      objectKey,
      expiresInSeconds: 60 * 10,
    };
  }

  async confirmDocumentMediaUpload(
    userId: string,
    documentId: string,
    payload: ConfirmDocumentMediaDto,
  ) {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }
    if (!access.permissions.canEdit) {
      throw new ForbiddenException('Bu dokumana medya ekleyemezsiniz.');
    }

    this.validateMediaInput(payload.contentType, payload.size);
    if (!payload.objectKey.startsWith(`documents/${documentId}/`)) {
      throw new BadRequestException('Geçersiz object key.');
    }

    const media = await this.prisma.mediaFile.create({
      data: {
        workspaceId: access.workspaceId,
        documentId,
        uploadedById: userId,
        objectKey: payload.objectKey,
        fileName: payload.fileName.trim(),
        mimeType: payload.contentType,
        size: payload.size,
        bucket: this.appConfig.storage.bucket,
      },
      select: {
        id: true,
        objectKey: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });

    return {
      media: {
        ...media,
        url: this.buildDocumentMediaFileUrl(documentId, media.id),
      },
    };
  }

  async readDocumentMediaBuffer(
    userId: string,
    documentId: string,
    mediaId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      return null;
    }

    const media = await this.prisma.mediaFile.findFirst({
      where: { id: mediaId, documentId },
      select: {
        objectKey: true,
        bucket: true,
        mimeType: true,
      },
    });
    if (!media) {
      return null;
    }

    try {
      const stream = await this.minioClient.getObject(media.bucket, media.objectKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return { buffer: Buffer.concat(chunks), mimeType: media.mimeType };
    } catch {
      return null;
    }
  }

  async streamDocumentMediaFile(
    userId: string,
    documentId: string,
    mediaId: string,
    res: Response,
  ): Promise<void> {
    const access = await this.getDocumentAccessContext(userId, documentId);
    if (!access || !access.permissions.canRead) {
      throw new NotFoundException('Document bulunamadı veya erişim yetkiniz yok.');
    }

    const media = await this.prisma.mediaFile.findFirst({
      where: { id: mediaId, documentId },
      select: {
        objectKey: true,
        bucket: true,
        mimeType: true,
        size: true,
      },
    });
    if (!media) {
      throw new NotFoundException('Medya bulunamadı.');
    }

    let stream: NodeJS.ReadableStream;
    try {
      stream = await this.minioClient.getObject(media.bucket, media.objectKey);
    } catch {
      throw new NotFoundException('Depolanan dosya bulunamadı.');
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', String(media.size));
    res.setHeader('Cache-Control', 'private, max-age=3600');

    try {
      await pipeline(stream, res);
    } catch {
      if (!res.headersSent) {
        throw new NotFoundException('Dosya aktarımı tamamlanamadı.');
      }
    }
  }

  private validateMediaInput(contentType: string, size: number) {
    const isImage = this.imageMimeTypes.has(contentType);
    const isDocument = this.documentMimeTypes.has(contentType);
    if (!isImage && !isDocument) {
      throw new BadRequestException(
        'Desteklenmeyen dosya türü. İzin verilen: PNG, JPEG, WEBP, PDF, DOC, DOCX, TXT, CSV.',
      );
    }
    const maxSize = isImage ? this.maxImageSizeBytes : this.maxDocumentSizeBytes;
    if (size <= 0 || size > maxSize) {
      throw new BadRequestException(
        isImage
          ? 'Maximum allowed file size is 5MB.'
          : 'Maximum allowed document size is 20MB.',
      );
    }
  }

  private safeExtension(fileName: string, contentType: string): string {
    const byType: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'text/plain': '.txt',
      'text/csv': '.csv',
    };

    const guessed = byType[contentType] ?? '';
    const trimmed = fileName.trim();
    if (!trimmed) return guessed;
    const idx = trimmed.lastIndexOf('.');
    if (idx <= 0 || idx === trimmed.length - 1) return guessed;
    const ext = trimmed.slice(idx).toLowerCase();
    const allowed = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.pdf',
      '.doc',
      '.docx',
      '.txt',
      '.csv',
    ]);
    if (allowed.has(ext)) {
      if (contentType === 'image/jpeg' && ext === '.jpeg') return '.jpg';
      return ext;
    }
    return guessed;
  }

  private async ensureBucketExists() {
    const bucket = this.appConfig.storage.bucket;
    const exists = await this.minioClient.bucketExists(bucket);
    if (!exists) {
      await this.minioClient.makeBucket(bucket);
    }
  }

  private buildDocumentMediaFileUrl(documentId: string, mediaId: string): string {
    const base = this.appConfig.app.publicApiUrl.replace(/\/+$/, '');
    return `${base}/documents/${documentId}/media/${mediaId}/file`;
  }

  private async getDocumentAccessContext(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
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

    const documentRole = document.members[0]?.role ?? null;
    const workspaceRole = document.workspace.members[0]?.role ?? null;
    const isWorkspaceAdmin =
      workspaceRole === WorkspaceRole.OWNER || workspaceRole === WorkspaceRole.ADMIN;
    const canRead = Boolean(documentRole) || isWorkspaceAdmin;
    const canEdit =
      documentRole === DocumentRole.OWNER ||
      documentRole === DocumentRole.EDITOR ||
      isWorkspaceAdmin;

    return {
      workspaceId: document.workspaceId,
      permissions: {
        canRead,
        canEdit,
      },
    };
  }
}
