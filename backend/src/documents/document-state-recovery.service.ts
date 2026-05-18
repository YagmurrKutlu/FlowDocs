import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Y from 'yjs';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

type RecoverySource = 'snapshot' | 'update-prefix';

interface RecoveryCandidateMetrics {
  ytextLength: number;
  hasSerialized: boolean;
  serializedParseOk: boolean;
  rootTextLength: number;
  hasCodeBlock: boolean;
  hasTable: boolean;
  hasImage: boolean;
  hasFileAttachment: boolean;
  isRecoverable: boolean;
}

interface RecoveryCandidate {
  source: RecoverySource;
  version: number;
  metrics: RecoveryCandidateMetrics;
  ydoc: Y.Doc;
  serialized: string | null;
}

interface StoredPrefixCandidate {
  version: number;
  metrics: RecoveryCandidateMetrics;
  stateBytes: Uint8Array;
  serialized: string | null;
}

export interface DocumentRecoveryResult {
  recovered: boolean;
  documentId: string;
  message: string;
  backupPath?: string;
  applied?: {
    source: RecoverySource;
    version: number;
    rootTextLength: number;
    newDocumentVersion: number;
    stateUpdateBase64: string;
    editorStateJson?: string;
  };
}

const UPDATE_PROGRESS_INTERVAL = 50;

@Injectable()
export class DocumentStateRecoveryService {
  private readonly logger = new Logger(DocumentStateRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly documentsService: DocumentsService,
  ) {}

  async recoverLatestNonEmptyState(
    userId: string,
    documentId: string,
  ): Promise<DocumentRecoveryResult> {
    this.assertRecoveryEnabled();

    const access = await this.documentsService.assertDocumentReadAccess(
      userId,
      documentId,
    );
    if (!access.permissions.canShare) {
      throw new ForbiddenException(
        'Only document owners or workspace admins can run state recovery.',
      );
    }

    return this.runRecovery(documentId, userId);
  }

  /** CLI / internal entry — no auth; caller must enforce access. */
  async runRecovery(
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentRecoveryResult> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        currentVersion: true,
        previewContent: true,
        editorStateJson: true,
        createdById: true,
        deletedAt: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    if (document.deletedAt) {
      throw new BadRequestException('Bu doküman çöp kutusunda.');
    }

    const editorStateJsonText = this.editorStateJsonAsString(document.editorStateJson);
    const previewPlain = this.previewContentAsPlain(document.previewContent);

    this.recoveryDebug('document current state', {
      documentId,
      currentVersion: document.currentVersion,
      editorStateJsonLength: editorStateJsonText.length,
      previewLength: previewPlain.length,
      editorStateRecoverable: this.isRecoverableFromSerialized(editorStateJsonText),
    });

    const candidate = await this.findBestRecoverableCandidate(documentId);
    if (!candidate) {
      this.recoveryDebug('no recoverable state found', { documentId });
      return {
        recovered: false,
        documentId,
        message: 'No recoverable non-empty state found in snapshot/update history.',
      };
    }

    this.recoveryDebug('candidate found', {
      source: candidate.source,
      version: candidate.version,
      rootTextLength: candidate.metrics.rootTextLength,
      ytextLength: candidate.metrics.ytextLength,
    });

    const backupPath = await this.writeRecoveryBackup(documentId, {
      editorStateJson: editorStateJsonText,
      previewContent: previewPlain,
      currentVersion: document.currentVersion,
    });

    const serialized =
      candidate.serialized ??
      candidate.ydoc.getMap<string>('lexicalState').get('serialized') ??
      null;
    const editorStateJsonValue = this.parseEditorStateJsonForStorage(serialized);
    if (!editorStateJsonValue) {
      this.recoveryDebug('no recoverable state found', {
        documentId,
        reason: 'candidate-serialized-invalid',
      });
      return {
        recovered: false,
        documentId,
        message: 'Candidate state could not be parsed as Lexical JSON.',
        backupPath,
      };
    }

    const plainTextContent =
      candidate.metrics.rootTextLength > 0
        ? this.extractPlainTextFromSerialized(JSON.stringify(editorStateJsonValue))
        : candidate.ydoc.getText('content').toString();

    if (!plainTextContent.trim() && candidate.metrics.rootTextLength === 0) {
      this.recoveryDebug('no recoverable state found', {
        documentId,
        reason: 'candidate-empty-after-parse',
      });
      return {
        recovered: false,
        documentId,
        message: 'Candidate state resolved to empty content.',
        backupPath,
      };
    }

    const snapshotBinary = Y.encodeStateAsUpdate(candidate.ydoc);
    const stateVector = Y.encodeStateVector(candidate.ydoc);
    const newVersion = document.currentVersion + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          currentVersion: newVersion,
          lastEditedById: actorUserId ?? undefined,
          previewContent: plainTextContent,
          editorStateJson: editorStateJsonValue,
        },
      });

      await tx.documentUpdate.create({
        data: {
          documentId,
          version: newVersion,
          updateBinary: Buffer.from(snapshotBinary),
          createdById: actorUserId ?? null,
          sourceClientId: 'recovery-tool',
        },
      });

      await tx.documentSnapshot.create({
        data: {
          documentId,
          version: newVersion,
          snapshotBinary: Buffer.from(snapshotBinary),
          stateVector: Buffer.from(stateVector),
          capturedById: actorUserId ?? document.createdById,
        },
      });
    });

    this.recoveryDebug('recovery applied', {
      source: candidate.source,
      version: candidate.version,
      newDocumentVersion: newVersion,
      rootTextLength: candidate.metrics.rootTextLength,
      backupPath,
    });

    return {
      recovered: true,
      documentId,
      message: 'Recovered non-empty state applied successfully.',
      backupPath,
      applied: {
        source: candidate.source,
        version: candidate.version,
        rootTextLength: candidate.metrics.rootTextLength,
        newDocumentVersion: newVersion,
        stateUpdateBase64: Buffer.from(snapshotBinary).toString('base64'),
        editorStateJson: serialized ?? undefined,
      },
    };
  }

  private async findBestRecoverableCandidate(
    documentId: string,
  ): Promise<RecoveryCandidate | null> {
    let best: RecoveryCandidate | null = null;

    const snapshots = await this.prisma.documentSnapshot.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { version: true, snapshotBinary: true },
    });

    this.recoveryDebug('scanning snapshots', { count: snapshots.length });

    for (let index = 0; index < snapshots.length; index++) {
      const snapshot = snapshots[index]!;
      const candidate = this.tryBuildSnapshotCandidate(snapshot.version, snapshot.snapshotBinary);
      if (candidate) {
        best = this.pickBetterCandidate(best, candidate);
      }
    }

    const updates = await this.prisma.documentUpdate.findMany({
      where: { documentId },
      orderBy: { version: 'asc' },
      select: { version: true, updateBinary: true },
    });

    this.recoveryDebug('scanning updates', { count: updates.length });

    const prefixCandidate = this.scanUpdatesPrefix(updates);
    if (prefixCandidate) {
      best = this.pickBetterCandidate(best, prefixCandidate);
    }

    this.recoveryDebug('scanning complete', {
      snapshotsScanned: snapshots.length,
      updatesScanned: updates.length,
      foundCandidate: Boolean(best),
      bestSource: best?.source ?? null,
      bestVersion: best?.version ?? null,
    });

    return best;
  }

  private tryBuildSnapshotCandidate(
    version: number,
    snapshotBinary: Uint8Array,
  ): RecoveryCandidate | null {
    const ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, new Uint8Array(snapshotBinary));
    } catch (error) {
      this.logInvalidCandidateSkipped('snapshot', version, 'yjs-apply-failed', error);
      return null;
    }

    return this.buildCandidateFromYDoc('snapshot', version, ydoc);
  }

  /**
   * Single forward pass over all updates — O(n) applyUpdate calls.
   * Tracks the latest recoverable prefix without per-step Y.Doc clones.
   */
  private scanUpdatesPrefix(
    updates: Array<{ version: number; updateBinary: Uint8Array }>,
  ): RecoveryCandidate | null {
    if (updates.length === 0) return null;

    const prefixDoc = new Y.Doc();
    let lastGood: StoredPrefixCandidate | null = null;
    const total = updates.length;

    for (let index = 0; index < total; index++) {
      const update = updates[index]!;

      if (index % UPDATE_PROGRESS_INTERVAL === 0) {
        this.recoveryDebug('scanning update progress', {
          index,
          total,
          version: update.version,
        });
      }

      try {
        Y.applyUpdate(prefixDoc, new Uint8Array(update.updateBinary));
      } catch (error) {
        this.logInvalidCandidateSkipped('update-prefix', update.version, 'yjs-apply-failed', error);
        continue;
      }

      const metrics = this.evaluateYDoc(prefixDoc);
      if (!metrics.isRecoverable) {
        continue;
      }

      if (!metrics.serializedParseOk && metrics.hasSerialized && metrics.rootTextLength === 0) {
        this.logInvalidCandidateSkipped(
          'update-prefix',
          update.version,
          'serialized-parse-failed',
        );
        continue;
      }

      try {
        lastGood = {
          version: update.version,
          metrics,
          stateBytes: Y.encodeStateAsUpdate(prefixDoc),
          serialized: prefixDoc.getMap<string>('lexicalState').get('serialized') ?? null,
        };
      } catch (error) {
        this.logInvalidCandidateSkipped(
          'update-prefix',
          update.version,
          'state-encode-failed',
          error,
        );
      }
    }

    this.recoveryDebug('scanning update progress', {
      index: total,
      total,
      version: updates[total - 1]?.version ?? null,
      done: true,
    });

    if (!lastGood) return null;

    const ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, lastGood.stateBytes);
    } catch (error) {
      this.logInvalidCandidateSkipped(
        'update-prefix',
        lastGood.version,
        'restored-state-apply-failed',
        error,
      );
      return null;
    }

    return {
      source: 'update-prefix',
      version: lastGood.version,
      metrics: lastGood.metrics,
      ydoc,
      serialized: lastGood.serialized,
    };
  }

  private buildCandidateFromYDoc(
    source: RecoverySource,
    version: number,
    ydoc: Y.Doc,
  ): RecoveryCandidate | null {
    const metrics = this.evaluateYDoc(ydoc);
    if (!metrics.isRecoverable) {
      return null;
    }

    if (!metrics.serializedParseOk && metrics.hasSerialized && metrics.rootTextLength === 0) {
      this.logInvalidCandidateSkipped(source, version, 'serialized-parse-failed');
      return null;
    }

    return {
      source,
      version,
      metrics,
      ydoc,
      serialized: ydoc.getMap<string>('lexicalState').get('serialized') ?? null,
    };
  }

  private logInvalidCandidateSkipped(
    source: RecoverySource,
    version: number,
    reason: string,
    error?: unknown,
  ): void {
    const detail =
      error instanceof Error ? error.message : error !== undefined ? String(error) : undefined;
    this.recoveryDebug('invalid candidate skipped', {
      source,
      version,
      reason,
      ...(detail ? { detail } : {}),
    });
  }

  private pickBetterCandidate(
    current: RecoveryCandidate | null,
    next: RecoveryCandidate,
  ): RecoveryCandidate | null {
    if (!next.metrics.isRecoverable) return current;
    if (!current) return next;
    if (next.version > current.version) return next;
    if (next.version < current.version) return current;
    if (next.metrics.rootTextLength > current.metrics.rootTextLength) return next;
    return current;
  }

  private evaluateYDoc(ydoc: Y.Doc, serializedOverride?: string): RecoveryCandidateMetrics {
    const ytextLength = ydoc.getText('content').toString().trim().length;
    const serialized =
      serializedOverride ?? ydoc.getMap<string>('lexicalState').get('serialized');
    const hasSerialized = typeof serialized === 'string' && serialized.length > 0;
    let serializedParseOk = false;
    let rootTextLength = ytextLength;
    let hasCodeBlock = false;
    let hasTable = false;
    let hasImage = false;
    let hasFileAttachment = false;

    if (hasSerialized && typeof serialized === 'string') {
      serializedParseOk = this.isValidLexicalRoot(serialized);
      const extracted = this.extractPlainTextFromSerialized(serialized);
      if (extracted.length > 0) {
        rootTextLength = Math.max(rootTextLength, extracted.length);
      }
      hasCodeBlock = /"type"\s*:\s*"code"/.test(serialized) || serialized.includes('CodeNode');
      hasTable =
        /"type"\s*:\s*"table"/.test(serialized) || serialized.includes('TableNode');
      hasImage =
        /"type"\s*:\s*"image"/.test(serialized) || serialized.includes('ImageNode');
      hasFileAttachment =
        serialized.includes('file-attachment') || serialized.includes('FileAttachmentNode');
    }

    const isRecoverable =
      rootTextLength > 0 ||
      (serializedParseOk &&
        hasSerialized &&
        (hasCodeBlock || hasTable || hasImage || hasFileAttachment));

    return {
      ytextLength,
      hasSerialized,
      serializedParseOk,
      rootTextLength,
      hasCodeBlock,
      hasTable,
      hasImage,
      hasFileAttachment,
      isRecoverable,
    };
  }

  private isRecoverableFromSerialized(serialized: string | null | undefined): boolean {
    if (!serialized?.trim()) return false;
    return this.evaluateYDoc(this.ydocFromSerialized(serialized) ?? new Y.Doc(), serialized)
      .isRecoverable;
  }

  private ydocFromSerialized(serialized: string): Y.Doc | null {
    if (!this.isValidLexicalRoot(serialized)) return null;
    const ydoc = new Y.Doc();
    ydoc.getMap<string>('lexicalState').set('serialized', serialized);
    const plain = this.extractPlainTextFromSerialized(serialized);
    if (plain.length > 0) {
      const ytext = ydoc.getText('content');
      if (ytext.length > 0) {
        ytext.delete(0, ytext.length);
      }
      ytext.insert(0, plain);
    }
    return ydoc;
  }

  private isValidLexicalRoot(serialized: string): boolean {
    try {
      const parsed = JSON.parse(serialized) as { root?: { children?: unknown } };
      return Array.isArray(parsed?.root?.children);
    } catch {
      return false;
    }
  }

  private extractPlainTextFromSerialized(serialized: string): string {
    try {
      const parsed = JSON.parse(serialized) as { root?: unknown };
      return this.walkLexicalText(parsed?.root).trim();
    } catch {
      return '';
    }
  }

  private walkLexicalText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const record = node as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string') {
      return record.text;
    }
    if (!Array.isArray(record.children)) return '';
    return record.children.map((child) => this.walkLexicalText(child)).join('');
  }

  private editorStateJsonAsString(value: Prisma.JsonValue | null): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private previewContentAsPlain(value: Prisma.JsonValue | null): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private parseEditorStateJsonForStorage(
    serialized: string | null,
  ): Prisma.InputJsonValue | null {
    if (!serialized?.trim()) return null;
    const trimmed = serialized.trim().replace(/\u0000/g, '');
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('root' in parsed) ||
        typeof (parsed as { root?: unknown }).root !== 'object' ||
        (parsed as { root: unknown }).root === null
      ) {
        return null;
      }
      const root = (parsed as { root: { children?: unknown } }).root;
      if (!Array.isArray(root.children)) return null;
      return parsed as Prisma.InputJsonValue;
    } catch {
      return null;
    }
  }

  private async writeRecoveryBackup(
    documentId: string,
    backup: {
      editorStateJson: string;
      previewContent: string;
      currentVersion: number;
    },
  ): Promise<string> {
    const dir = path.join(process.cwd(), 'recovery-backups');
    fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dir, `${documentId}-${timestamp}.json`);
    const payload = {
      documentId,
      backedUpAt: new Date().toISOString(),
      ...backup,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    this.recoveryDebug('backup written', { filePath });
    return filePath;
  }

  private assertRecoveryEnabled(): void {
    const nodeEnv = this.appConfig.app.nodeEnv;
    const allowProd = process.env.ALLOW_DOCUMENT_RECOVERY === 'true';
    if (nodeEnv === 'production' && !allowProd) {
      throw new ForbiddenException(
        'Document recovery is disabled in production. Set ALLOW_DOCUMENT_RECOVERY=true to enable.',
      );
    }
  }

  private recoveryDebug(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.log(`[recovery-debug] ${message} ${JSON.stringify(data)}`);
    } else {
      this.logger.log(`[recovery-debug] ${message}`);
    }
  }
}
