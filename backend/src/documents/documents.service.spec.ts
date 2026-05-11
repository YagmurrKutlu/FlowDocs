import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  describe('deleteDocumentComment', () => {
    let service: DocumentsService;
    const prismaMock = {
      document: { findUnique: jest.fn() },
      documentComment: { findFirst: jest.fn(), delete: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DocumentsService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();
      service = module.get(DocumentsService);
    });

    function mockViewerAccess() {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        workspaceId: 'ws-1',
        members: [{ role: DocumentRole.VIEWER }],
        workspace: { members: [] },
      });
    }

    it('deletes when user is the author (viewer role)', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-1',
      });
      prismaMock.documentComment.delete.mockResolvedValue({ id: 'comment-1' });

      await expect(
        service.deleteDocumentComment('user-1', 'doc-1', 'comment-1'),
      ).resolves.toEqual({ deleted: true });

      expect(prismaMock.documentComment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });

    it('deletes when user can edit (not author)', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        workspaceId: 'ws-1',
        members: [{ role: DocumentRole.EDITOR }],
        workspace: { members: [] },
      });
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'other-user',
      });
      prismaMock.documentComment.delete.mockResolvedValue({ id: 'comment-1' });

      await expect(
        service.deleteDocumentComment('user-1', 'doc-1', 'comment-1'),
      ).resolves.toEqual({ deleted: true });
    });

    it('throws NotFound when comment is missing for document', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocumentComment('user-1', 'doc-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.documentComment.delete).not.toHaveBeenCalled();
    });

    it('throws Forbidden when viewer tries to delete someone else comment', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'other-user',
      });

      await expect(
        service.deleteDocumentComment('user-1', 'doc-1', 'comment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.documentComment.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound when user cannot read document', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        workspaceId: 'ws-1',
        members: [],
        workspace: { members: [] },
      });

      await expect(
        service.deleteDocumentComment('user-1', 'doc-1', 'comment-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.documentComment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('updateDocumentComment', () => {
    let service: DocumentsService;
    const prismaMock = {
      document: { findUnique: jest.fn() },
      documentComment: { findFirst: jest.fn(), update: jest.fn() },
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DocumentsService,
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();
      service = module.get(DocumentsService);
    });

    function mockViewerAccess() {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        workspaceId: 'ws-1',
        members: [{ role: DocumentRole.VIEWER }],
        workspace: { members: [] },
      });
    }

    function mockUpdatedComment() {
      prismaMock.documentComment.update.mockResolvedValue({
        id: 'comment-1',
        documentId: 'doc-1',
        body: 'Updated body',
        selectedText: 'Selected',
        anchorOffset: 1,
        focusOffset: 2,
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        author: {
          id: 'user-1',
          fullName: 'Author',
          email: 'author@example.com',
          avatarUrl: null,
        },
        resolvedBy: null,
      });
    }

    it('updates when user is the author (viewer role)', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-1',
      });
      mockUpdatedComment();

      await expect(
        service.updateDocumentComment('user-1', 'doc-1', 'comment-1', {
          body: 'Updated body',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          comment: expect.objectContaining({
            id: 'comment-1',
            body: 'Updated body',
            selectedText: 'Selected',
            anchorOffset: 1,
            focusOffset: 2,
          }),
        }),
      );
    });

    it('throws NotFound when comment does not belong to document', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDocumentComment('user-1', 'doc-1', 'missing', {
          body: 'Updated body',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.documentComment.update).not.toHaveBeenCalled();
    });

    it('throws Forbidden when viewer tries to edit another user comment', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'other-user',
      });

      await expect(
        service.updateDocumentComment('user-1', 'doc-1', 'comment-1', {
          body: 'Updated body',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.documentComment.update).not.toHaveBeenCalled();
    });

    it('throws BadRequest for empty body', async () => {
      mockViewerAccess();
      prismaMock.documentComment.findFirst.mockResolvedValue({
        id: 'comment-1',
        authorId: 'user-1',
      });

      await expect(
        service.updateDocumentComment('user-1', 'doc-1', 'comment-1', {
          body: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.documentComment.update).not.toHaveBeenCalled();
    });
  });
});
