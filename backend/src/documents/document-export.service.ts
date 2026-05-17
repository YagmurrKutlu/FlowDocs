import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { DocumentsService } from './documents.service';
import type { ExportFormatDto } from './dto/export-document-query.dto';
import { buildExportDocx } from './export/lexical-export.docx';
import { buildExportHtml } from './export/lexical-export.html';
import { buildExportMarkdown } from './export/lexical-export.markdown';
import { buildExportPdf } from './export/lexical-export.pdf';
import type { ExportBuildContext, ResolvedExportImage } from './export/lexical-export.types';
import {
  parseLexicalEditorState,
  sanitizeExportFilename,
} from './export/lexical-export.utils';

const EXPORT_TIMEOUT_MS = 120_000;

export type DocumentExportResult = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

@Injectable()
export class DocumentExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly mediaService: MediaService,
  ) {}

  async exportDocument(
    userId: string,
    documentId: string,
    format: ExportFormatDto,
  ): Promise<DocumentExportResult> {
    const title = await this.documentsService.assertDocumentExportAccess(userId, documentId);
    const editorStateJson = await this.loadEditorStateJson(documentId);
    const exportDoc = parseLexicalEditorState(editorStateJson, title, documentId);
    const context: ExportBuildContext = {
      title: exportDoc.title,
      blocks: exportDoc.blocks,
      resolveImage: async (mediaId) => this.resolveImage(userId, documentId, mediaId),
    };

    const exportPromise = this.buildBuffer(format, context);
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const buffer = await Promise.race([
        exportPromise,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new RequestTimeoutException('Dışa aktarma zaman aşımına uğradı.')),
            EXPORT_TIMEOUT_MS,
          );
        }),
      ]);
      const mimeType = this.mimeTypeForFormat(format);
      return {
        buffer,
        mimeType,
        filename: sanitizeExportFilename(title, format),
      };
    } catch (error) {
      if (error instanceof RequestTimeoutException) throw error;
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Belge dışa aktarılamadı. Lütfen tekrar deneyin.');
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private async buildBuffer(
    format: ExportFormatDto,
    context: ExportBuildContext,
  ): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return buildExportPdf(context);
      case 'docx':
        return buildExportDocx(context);
      case 'html': {
        const html = await buildExportHtml(context);
        return Buffer.from(html, 'utf8');
      }
      case 'markdown': {
        const markdown = buildExportMarkdown(context);
        return Buffer.from(markdown, 'utf8');
      }
      default:
        throw new BadRequestException('Desteklenmeyen dışa aktarma formatı.');
    }
  }

  private mimeTypeForFormat(format: ExportFormatDto): string {
    const map: Record<ExportFormatDto, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html; charset=utf-8',
      markdown: 'text/markdown; charset=utf-8',
    };
    return map[format];
  }

  private async loadEditorStateJson(documentId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ editorStateJson: string | null }>>`
      SELECT "editorStateJson"::text as "editorStateJson"
      FROM "Document"
      WHERE "id" = ${documentId}
      LIMIT 1
    `;
    const raw = rows[0]?.editorStateJson;
    if (!raw || raw.trim().length === 0) {
      return JSON.stringify({ root: { type: 'root', version: 1, children: [] } });
    }
    return raw;
  }

  private async resolveImage(
    userId: string,
    documentId: string,
    mediaId: string,
  ): Promise<ResolvedExportImage | null> {
    const result = await this.mediaService.readDocumentMediaBuffer(userId, documentId, mediaId);
    if (!result) return null;
    if (!result.mimeType.startsWith('image/')) return null;
    return result;
  }
}
