import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRole } from '@prisma/client';
import { DocumentMessagesService } from './document-messages.service';
import { DocumentsService } from './documents.service';

describe('DocumentMessagesService', () => {
  const prismaMock = {
    documentMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const documentsServiceMock = {
    assertDocumentReadAccess: jest.fn(),
  };

  const realtimeServiceMock = {
    publishDocumentMessageCreated: jest.fn(),
    publishDocumentMessageDeleted: jest.fn(),
  };

  let service: DocumentMessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentMessagesService(
      prismaMock as never,
      documentsServiceMock as unknown as DocumentsService,
      realtimeServiceMock as never,
    );
  });

  function mockReadAccess(overrides?: {
    canShare?: boolean;
    currentUserRole?: DocumentRole | null;
  }) {
    documentsServiceMock.assertDocumentReadAccess.mockResolvedValue({
      documentId: 'doc-1',
      documentTitle: 'Test Doc',
      workspaceId: 'ws-1',
      currentUserRole: overrides?.currentUserRole ?? DocumentRole.VIEWER,
      permissions: {
        canRead: true,
        canEdit: false,
        canShare: overrides?.canShare ?? false,
      },
    });
  }

  const sampleRow = {
    id: 'msg-1',
    documentId: 'doc-1',
    body: 'Merhaba',
    createdAt: new Date('2026-05-15T10:00:00.000Z'),
    authorId: 'user-1',
    author: {
      id: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
    },
  };

  describe('listDocumentMessages', () => {
    it('returns messages for users with read access', async () => {
      mockReadAccess({ currentUserRole: DocumentRole.VIEWER });
      prismaMock.documentMessage.findMany.mockResolvedValue([sampleRow]);

      const result = await service.listDocumentMessages('user-1', 'doc-1');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        id: 'msg-1',
        documentId: 'doc-1',
        body: 'Merhaba',
        createdAt: sampleRow.createdAt,
        author: {
          id: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
        },
        isMine: true,
      });
      expect(prismaMock.documentMessage.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: expect.any(Object),
      });
    });

    it('propagates forbidden when read access is denied', async () => {
      documentsServiceMock.assertDocumentReadAccess.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(service.listDocumentMessages('user-2', 'doc-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('createDocumentMessage', () => {
    it('allows viewer to create a message', async () => {
      mockReadAccess({ currentUserRole: DocumentRole.VIEWER });
      prismaMock.documentMessage.create.mockResolvedValue(sampleRow);

      const result = await service.createDocumentMessage('user-1', 'doc-1', {
        body: '  Merhaba  ',
      });

      expect(result.message.body).toBe('Merhaba');
      expect(result.message.isMine).toBe(true);
      expect(prismaMock.documentMessage.create).toHaveBeenCalledWith({
        data: {
          documentId: 'doc-1',
          authorId: 'user-1',
          body: 'Merhaba',
        },
        select: expect.any(Object),
      });
    });

    it('rejects empty body after trim', async () => {
      mockReadAccess();

      await expect(
        service.createDocumentMessage('user-1', 'doc-1', { body: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteDocumentMessage', () => {
    it('allows message author to soft delete', async () => {
      mockReadAccess({ currentUserRole: DocumentRole.VIEWER });
      prismaMock.documentMessage.findFirst.mockResolvedValue({
        id: 'msg-1',
        authorId: 'user-1',
      });
      prismaMock.documentMessage.update.mockResolvedValue({ id: 'msg-1' });

      const result = await service.deleteDocumentMessage('user-1', 'doc-1', 'msg-1');

      expect(result).toEqual({ deleted: true });
      expect(prismaMock.documentMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('allows document owner to soft delete another users message', async () => {
      mockReadAccess({
        currentUserRole: DocumentRole.OWNER,
        canShare: true,
      });
      prismaMock.documentMessage.findFirst.mockResolvedValue({
        id: 'msg-1',
        authorId: 'user-2',
      });
      prismaMock.documentMessage.update.mockResolvedValue({ id: 'msg-1' });

      await expect(
        service.deleteDocumentMessage('user-1', 'doc-1', 'msg-1'),
      ).resolves.toEqual({ deleted: true });
    });

    it('forbids non-owner from deleting another users message', async () => {
      mockReadAccess({ currentUserRole: DocumentRole.EDITOR });
      prismaMock.documentMessage.findFirst.mockResolvedValue({
        id: 'msg-1',
        authorId: 'user-2',
      });

      await expect(
        service.deleteDocumentMessage('user-1', 'doc-1', 'msg-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.documentMessage.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when message is missing', async () => {
      mockReadAccess();
      prismaMock.documentMessage.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocumentMessage('user-1', 'doc-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
