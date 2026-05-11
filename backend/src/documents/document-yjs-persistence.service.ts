import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRole, Prisma, WorkspaceRole } from '@prisma/client';
import * as Y from 'yjs';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DocumentYjsPersistenceService {
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

    const ydoc = await this.restoreYDoc(this.prisma, documentId);
    const stateUpdate = Y.encodeStateAsUpdate(ydoc);
    const stateUpdateBase64 = Buffer.from(stateUpdate).toString('base64');
    const editorStateRow = await this.prisma.$queryRaw<
      Array<{ editorStateJson: string | null }>
    >`SELECT "editorStateJson"::text as "editorStateJson" FROM "Document" WHERE "id" = ${documentId} LIMIT 1`;

    return {
      currentVersion: document.currentVersion,
      editorStateJson: editorStateRow[0]?.editorStateJson ?? null,
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
        try {
          Y.applyUpdate(ydoc, updateBytes);
        } catch {
          throw new BadRequestException('Geçersiz Yjs güncellemesi.');
        }

        const normalizedEditorStateJson =
          this.normalizeSerializedEditorState(editorStateJson);
        const plainTextContent = ydoc.getText('content').toString();

        const updated = await tx.document.update({
          where: { id: documentId },
          data: {
            currentVersion: { increment: 1 },
            lastEditedById: userId,
            previewContent: plainTextContent,
          },
          select: { currentVersion: true },
        });
        const version = updated.currentVersion;

        if (normalizedEditorStateJson) {
          await tx.$executeRaw`
            UPDATE "Document"
            SET "editorStateJson" = ${normalizedEditorStateJson}::jsonb
            WHERE "id" = ${documentId}
          `;
        }

        await tx.documentUpdate.create({
          data: {
            documentId,
            version,
            updateBinary: Buffer.from(updateBytes),
            createdById: userId,
            sourceClientId: sourceClientId ?? null,
          },
        });

        if (version > 0 && version % snapshotInterval === 0) {
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

  private normalizeSerializedEditorState(
    serialized?: string,
  ): string | undefined {
    if (typeof serialized !== 'string') return undefined;
    const trimmed = serialized.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('root' in parsed) ||
        typeof (parsed as { root?: unknown }).root !== 'object' ||
        (parsed as { root: unknown }).root === null
      ) {
        return undefined;
      }
      const root = (parsed as { root: { children?: unknown } }).root;
      if (!Array.isArray(root.children)) return undefined;
      return JSON.stringify(parsed);
    } catch {
      return undefined;
    }
  }
}
