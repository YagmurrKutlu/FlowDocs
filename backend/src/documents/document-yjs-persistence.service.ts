import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRole, Prisma, WorkspaceRole } from '@prisma/client';
import * as Y from 'yjs';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  evaluateDestructiveEmptyRejection,
  hasRichLexicalEditorStateJson,
} from './document-persistence-guard';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DocumentYjsPersistenceService {
  private readonly logger = new Logger(DocumentYjsPersistenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  async getDocumentState(userId: string, documentId: string) {
    const document = await this.findReadableDocument(userId, documentId);
    if (!document) {
      throw new NotFoundException(
        'Document bulunamadı veya erişim yetkiniz yok.',
      );
    }

    const [latestSnapshot, totalUpdates] = await Promise.all([
      this.prisma.documentSnapshot.findFirst({
        where: { documentId },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
      this.prisma.documentUpdate.count({ where: { documentId } }),
    ]);

    const snapshotVersion = latestSnapshot?.version ?? null;
    const updatesAfterSnapshot = snapshotVersion
      ? await this.prisma.documentUpdate.count({
          where: { documentId, version: { gt: snapshotVersion } },
        })
      : totalUpdates;

    let ydoc = await this.restoreYDoc(this.prisma, documentId);
    const editorStateRow = await this.prisma.$queryRaw<
      Array<{ editorStateJson: string | null; previewContent: string | null }>
    >`SELECT "editorStateJson"::text as "editorStateJson", "previewContent" FROM "Document" WHERE "id" = ${documentId} LIMIT 1`;
    const editorStateJson = editorStateRow[0]?.editorStateJson ?? null;
    const previewContent = editorStateRow[0]?.previewContent ?? null;

    if (
      !this.yjsHasSubstantiveContent(ydoc) &&
      !this.hasRichEditorStateJson(editorStateJson) &&
      (previewContent?.trim().length ?? 0) === 0 &&
      totalUpdates > 0
    ) {
      const recovered = await this.tryRecoverNonEmptyYDoc(documentId);
      if (recovered) {
        this.logger.warn(
          JSON.stringify({
            event: 'document_state_recovered_from_snapshot',
            documentId,
          }),
        );
        ydoc = recovered;
      }
    }

    const stateUpdate = Y.encodeStateAsUpdate(ydoc);
    const stateUpdateBase64 = Buffer.from(stateUpdate).toString('base64');

    return {
      currentVersion: document.currentVersion,
      editorStateJson,
      previewContent,
      snapshotVersion,
      totalUpdates,
      updatesAfterSnapshot,
      stateUpdateBase64,
      snapshotInterval: this.appConfig.document.snapshotInterval,
    };
  }

  async applyUpdate(
    userId: string,
    documentId: string,
    updateBase64: string,
    sourceClientId?: string,
    editorStateJson?: string,
  ) {
    if (typeof updateBase64 !== 'string' || updateBase64.trim().length === 0) {
      throw new BadRequestException('updateBase64 zorunludur.');
    }

    let updateBytes: Uint8Array;
    try {
      updateBytes = new Uint8Array(Buffer.from(updateBase64, 'base64'));
    } catch {
      throw new BadRequestException('Geçersiz base64 güncelleme verisi.');
    }

    if (updateBytes.length === 0) {
      throw new BadRequestException('Boş güncelleme kabul edilmez.');
    }

    const snapshotInterval = this.appConfig.document.snapshotInterval;
    const editorStateJsonValue = this.parseEditorStateJsonForStorage(editorStateJson);

    const storedRow = await this.prisma.$queryRaw<
      Array<{ editorStateJson: string | null; previewContent: string | null }>
    >`SELECT "editorStateJson"::text as "editorStateJson", "previewContent" FROM "Document" WHERE "id" = ${documentId} LIMIT 1`;
    const storedEditorStateJson = storedRow[0]?.editorStateJson ?? null;
    const storedPreviewContent = this.previewContentToPlain(storedRow[0]?.previewContent);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const document = await this.findReadableDocumentInTx(
          tx,
          userId,
          documentId,
        );
        if (!document) {
          throw new NotFoundException(
            'Document bulunamadı veya erişim yetkiniz yok.',
          );
        }

        if (!this.canEditDocument(document)) {
          throw new ForbiddenException('Bu belgeyi düzenleme yetkiniz yok.');
        }

        const ydoc = await this.restoreYDoc(tx, documentId);
        const yjsBeforeHasContent = this.yjsHasSubstantiveContent(ydoc);
        try {
          Y.applyUpdate(ydoc, updateBytes);
        } catch {
          throw new BadRequestException('Geçersiz Yjs güncellemesi.');
        }

        const yjsAfterHasContent = this.yjsHasSubstantiveContent(ydoc);
        if (
          evaluateDestructiveEmptyRejection({
            documentEditorStateJson: storedEditorStateJson,
            documentPreviewContent: storedPreviewContent,
            yjsBeforeHasContent,
            yjsAfterHasContent,
            incomingEditorStateJson: editorStateJson,
          })
        ) {
          this.logger.warn(
            `[persistence-guard] rejected destructive empty update ${JSON.stringify({
              documentId,
              userId,
              yjsBeforeHasContent,
              yjsAfterHasContent,
              hasStoredEditorStateJson: hasRichLexicalEditorStateJson(storedEditorStateJson),
              hasStoredPreview: storedPreviewContent.trim().length > 0,
            })}`,
          );
          throw new ConflictException(
            'Destructive empty update rejected; document content is preserved.',
          );
        }

        const plainTextContent = ydoc.getText('content').toString();
        const hasContentAfter = yjsAfterHasContent;

        const updated = await tx.document.update({
          where: { id: documentId },
          data: {
            currentVersion: { increment: 1 },
            lastEditedById: userId,
            previewContent: plainTextContent,
            ...(editorStateJsonValue !== undefined
              ? { editorStateJson: editorStateJsonValue }
              : {}),
          },
          select: { currentVersion: true },
        });
        const version = updated.currentVersion;

        await tx.documentUpdate.create({
          data: {
            documentId,
            version,
            updateBinary: Buffer.from(updateBytes),
            createdById: userId,
            sourceClientId: sourceClientId ?? null,
          },
        });

        if (
          version > 0 &&
          version % snapshotInterval === 0 &&
          hasContentAfter
        ) {
          try {
            const snapshotBinary = Y.encodeStateAsUpdate(ydoc);
            const stateVector = Y.encodeStateVector(ydoc);
            await tx.documentSnapshot.create({
              data: {
                documentId,
                version,
                snapshotBinary: Buffer.from(snapshotBinary),
                stateVector: Buffer.from(stateVector),
                capturedById: userId,
              },
            });
          } catch (error) {
            this.logger.error(
              `[persistence-guard] snapshot create failed ${JSON.stringify({
                documentId,
                version,
                message: error instanceof Error ? error.message : String(error),
              })}`,
            );
          }
        }

        return { version };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Belge sürümü çakışması; yeniden deneyin.',
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        this.logger.error(
          JSON.stringify({
            event: 'document_update_prisma_validation_error',
            documentId,
            message: error.message,
          }),
        );
        throw new BadRequestException('Belge verisi doğrulanamadı.');
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          JSON.stringify({
            event: 'document_update_prisma_error',
            documentId,
            code: error.code,
            meta: error.meta,
          }),
        );
        throw new BadRequestException('Belge güncellenemedi.');
      }

      this.logger.error(
        JSON.stringify({
          event: 'document_update_failed',
          documentId,
          updateBase64Length: updateBase64.length,
          hasEditorStateJson: typeof editorStateJson === 'string',
          editorStateJsonLength:
            typeof editorStateJson === 'string' ? editorStateJson.length : 0,
          previewContentLength: 0,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async restoreYDoc(db: Db, documentId: string): Promise<Y.Doc> {
    const ydoc = new Y.Doc();

    const latestSnapshot = await db.documentSnapshot.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
    });

    if (latestSnapshot) {
      Y.applyUpdate(ydoc, new Uint8Array(latestSnapshot.snapshotBinary));
    }

    const minVersion = latestSnapshot?.version ?? 0;
    const updates = await db.documentUpdate.findMany({
      where: {
        documentId,
        ...(minVersion > 0 ? { version: { gt: minVersion } } : {}),
      },
      orderBy: { version: 'asc' },
      select: { updateBinary: true, version: true },
    });

    for (const row of updates) {
      Y.applyUpdate(ydoc, new Uint8Array(row.updateBinary));
    }

    return ydoc;
  }

  private async findReadableDocument(userId: string, documentId: string) {
    return this.findReadableDocumentInTx(this.prisma, userId, documentId);
  }

  private async findReadableDocumentInTx(
    tx: Db,
    userId: string,
    documentId: string,
  ) {
    return tx.document.findFirst({
      where: {
        id: documentId,
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
            members: { some: { userId } },
          },
        ],
      },
      select: {
        id: true,
        currentVersion: true,
        members: {
          where: { userId },
          select: { role: true },
        },
        workspace: {
          select: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });
  }

  private previewContentToPlain(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    return value.trim();
  }

  private yjsHasSubstantiveContent(ydoc: Y.Doc): boolean {
    const plain = ydoc.getText('content').toString().trim();
    if (plain.length > 0) return true;
    return hasRichLexicalEditorStateJson(
      ydoc.getMap<string>('lexicalState').get('serialized'),
    );
  }

  private hasRichEditorStateJson(serialized: string | null | undefined): boolean {
    return hasRichLexicalEditorStateJson(serialized);
  }

  private async tryRecoverNonEmptyYDoc(documentId: string): Promise<Y.Doc | null> {
    const snapshots = await this.prisma.documentSnapshot.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      take: 12,
      select: { version: true, snapshotBinary: true },
    });

    for (const snapshot of snapshots) {
      const candidate = new Y.Doc();
      Y.applyUpdate(candidate, new Uint8Array(snapshot.snapshotBinary));
      if (!this.yjsHasSubstantiveContent(candidate)) {
        continue;
      }

      const updates = await this.prisma.documentUpdate.findMany({
        where: { documentId, version: { gt: snapshot.version } },
        orderBy: { version: 'asc' },
        select: { updateBinary: true },
      });
      for (const row of updates) {
        Y.applyUpdate(candidate, new Uint8Array(row.updateBinary));
      }

      if (this.yjsHasSubstantiveContent(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private canEditDocument(
    document: NonNullable<
      Awaited<
        ReturnType<DocumentYjsPersistenceService['findReadableDocumentInTx']>
      >
    >,
  ): boolean {
    const docMembership = document.members[0];
    if (
      docMembership &&
      (docMembership.role === DocumentRole.OWNER ||
        docMembership.role === DocumentRole.EDITOR)
    ) {
      return true;
    }

    const wsMembership = document.workspace.members[0];
    if (
      wsMembership &&
      (wsMembership.role === WorkspaceRole.OWNER ||
        wsMembership.role === WorkspaceRole.ADMIN)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Opaque Lexical snapshot — validate JSON shape only, never inspect node types.
   */
  private parseEditorStateJsonForStorage(
    serialized?: string,
  ): Prisma.InputJsonValue | undefined {
    if (typeof serialized !== 'string') return undefined;
    const trimmed = serialized.trim().replace(/\u0000/g, '');
    if (!trimmed) return undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      throw new BadRequestException('editorStateJson geçerli JSON değil.');
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('root' in parsed) ||
      typeof (parsed as { root?: unknown }).root !== 'object' ||
      (parsed as { root: unknown }).root === null
    ) {
      throw new BadRequestException('editorStateJson Lexical root içermiyor.');
    }

    const root = (parsed as { root: { children?: unknown } }).root;
    if (!Array.isArray(root.children)) {
      throw new BadRequestException('editorStateJson root.children geçersiz.');
    }

    return parsed as Prisma.InputJsonValue;
  }
}
