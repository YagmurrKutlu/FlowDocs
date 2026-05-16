import { BadRequestException } from '@nestjs/common';
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
});
