import { BadRequestException, ConflictException } from '@nestjs/common';
import { DocumentRole, WorkspaceRole } from '@prisma/client';
import * as Y from 'yjs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentYjsPersistenceService } from './document-yjs-persistence.service';

describe('DocumentYjsPersistenceService', () => {
  let service: DocumentYjsPersistenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentYjsPersistenceService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AppConfigService,
          useValue: { document: { snapshotInterval: 50 } },
        },
      ],
    }).compile();

    service = module.get(DocumentYjsPersistenceService);
  });

  describe('parseEditorStateJsonForStorage (private)', () => {
    const parse = (value?: string) =>
      (
        service as unknown as {
          parseEditorStateJsonForStorage: (
            serialized?: string,
          ) => unknown;
        }
      ).parseEditorStateJsonForStorage(value);

    it('accepts opaque Lexical JSON with CodeNode and code-highlight children', () => {
      const payload = JSON.stringify({
        root: {
          children: [
            {
              type: 'code',
              version: 1,
              children: [
                {
                  type: 'code-highlight',
                  version: 1,
                  text: '{\n  "name": "FlowDocs"\n}',
                  highlightType: null,
                },
              ],
            },
          ],
          type: 'root',
          version: 1,
        },
      });

      const result = parse(payload);
      expect(result).toBeTruthy();
      expect(
        (result as { root: { children: Array<{ type: string }> } }).root
          .children[0]?.type,
      ).toBe('code');
    });

    it('rejects invalid JSON', () => {
      expect(() => parse('{not-json')).toThrow(BadRequestException);
    });

    it('returns undefined for empty input', () => {
      expect(parse(undefined)).toBeUndefined();
      expect(parse('   ')).toBeUndefined();
    });
  });

  describe('applyUpdate destructive empty guard', () => {
    const documentId = 'doc-1';
    const userId = 'user-1';
    const NON_EMPTY_JSON = JSON.stringify({
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [{ type: 'text', version: 1, text: 'keep me' }],
          },
        ],
      },
    });

    function buildServiceWithMocks(overrides: {
      storedEditorStateJson?: string | null;
      storedPreviewContent?: string | null;
      restoreYDoc?: Y.Doc;
    }) {
      const ydoc = overrides.restoreYDoc ?? (() => {
        const doc = new Y.Doc();
        doc.getText('content').insert(0, 'existing');
        return doc;
      })();

      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            editorStateJson: overrides.storedEditorStateJson ?? null,
            previewContent: overrides.storedPreviewContent ?? null,
          },
        ]),
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            document: {
              update: jest.fn().mockResolvedValue({ currentVersion: 2 }),
            },
            documentUpdate: { create: jest.fn().mockResolvedValue({}) },
            documentSnapshot: { create: jest.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        }),
      };

      const svc = new DocumentYjsPersistenceService(
        prisma as never,
        { document: { snapshotInterval: 50 } } as never,
      );

      jest.spyOn(svc, 'restoreYDoc' as never).mockResolvedValue(ydoc);
      jest.spyOn(svc, 'findReadableDocumentInTx' as never).mockResolvedValue({
        id: documentId,
        currentVersion: 1,
        members: [{ role: DocumentRole.OWNER }],
        workspace: { members: [{ role: WorkspaceRole.OWNER }] },
      });
      return { svc, prisma };
    }

    function minimalUpdateBase64(): string {
      return Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())).toString('base64');
    }

    it('rejects destructive empty update when previewContent is non-empty', async () => {
      const emptyYdoc = new Y.Doc();
      const { svc } = buildServiceWithMocks({
        storedPreviewContent: 'body',
        restoreYDoc: emptyYdoc,
      });

      await expect(
        svc.applyUpdate(userId, documentId, minimalUpdateBase64()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects destructive empty update when editorStateJson is non-empty', async () => {
      const emptyYdoc = new Y.Doc();
      const { svc } = buildServiceWithMocks({
        storedEditorStateJson: NON_EMPTY_JSON,
        restoreYDoc: emptyYdoc,
      });

      await expect(
        svc.applyUpdate(userId, documentId, minimalUpdateBase64()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows empty update for truly empty document', async () => {
      const empty = new Y.Doc();
      const { svc, prisma } = buildServiceWithMocks({
        storedEditorStateJson: null,
        storedPreviewContent: null,
        restoreYDoc: empty,
      });

      const updateBase64 = Buffer.from(Y.encodeStateAsUpdate(empty)).toString('base64');
      const result = await svc.applyUpdate(userId, documentId, updateBase64);
      expect(result.version).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
