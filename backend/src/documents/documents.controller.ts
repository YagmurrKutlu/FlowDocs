import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Patch,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { ApplyDocumentUpdateDto } from './dto/apply-document-update.dto';
import { AddDocumentMemberDto } from './dto/add-document-member.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { CreateDocumentMessageDto } from './dto/create-document-message.dto';
import { DocumentMessagesService } from './document-messages.service';
import { BulkDocumentsTrashDto } from './dto/bulk-documents-trash.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentCommentDto } from './dto/update-document-comment.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateDocumentMemberDto } from './dto/update-document-member.dto';
import { DocumentExportService } from './document-export.service';
import { DocumentStateRecoveryService } from './document-state-recovery.service';
import { DocumentYjsPersistenceService } from './document-yjs-persistence.service';
import { ExportDocumentQueryDto } from './dto/export-document-query.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentMessagesService: DocumentMessagesService,
    private readonly documentYjsPersistence: DocumentYjsPersistenceService,
    private readonly documentStateRecovery: DocumentStateRecoveryService,
    private readonly documentExportService: DocumentExportService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Post()
  createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateDocumentDto,
  ) {
    return this.documentsService.createDocument(user.id, payload);
  }

  @Get()
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.documentsService.listAccessibleDocuments(user.id, query);
  }

  @Get('summary')
  getDocumentsSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.getDocumentsSummary(user.id);
  }

  @Post('bulk-trash')
  bulkMoveToTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: BulkDocumentsTrashDto,
  ) {
    return this.documentsService.bulkMoveToTrash(user.id, payload);
  }

  @Get(':id/state')
  getDocumentState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentYjsPersistence.getDocumentState(user.id, id);
  }

  @Post(':id/recover-latest-non-empty-state')
  async recoverLatestNonEmptyState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.documentStateRecovery.recoverLatestNonEmptyState(
      user.id,
      id,
    );

    if (result.recovered && result.applied?.stateUpdateBase64) {
      this.realtimeService.publishDocumentUpdate({
        documentId: id,
        updateBase64: result.applied.stateUpdateBase64,
        sourceClientId: 'recovery-tool',
        ...(result.applied.editorStateJson
          ? { editorStateJson: result.applied.editorStateJson }
          : {}),
      });
    }

    return result;
  }

  @Post(':id/updates')
  async applyDocumentUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ApplyDocumentUpdateDto,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'document_update_request',
        documentId: id,
        updateBase64Length:
          typeof body.updateBase64 === 'string' ? body.updateBase64.length : 0,
        hasEditorStateJson: typeof body.editorStateJson === 'string',
        editorStateJsonLength:
          typeof body.editorStateJson === 'string'
            ? body.editorStateJson.length
            : 0,
        hasSourceClientId:
          typeof body.sourceClientId === 'string' &&
          body.sourceClientId.length > 0,
      }),
    );

    const result = await this.documentYjsPersistence.applyUpdate(
      user.id,
      id,
      body.updateBase64,
      body.sourceClientId,
      body.editorStateJson,
    );

    this.logger.log(
      JSON.stringify({
        event: 'socket-debug',
        action: 'document update persisted, broadcasting',
        documentId: id,
        version: result.version,
        updateBase64Length: body.updateBase64.length,
        hasEditorStateJson: typeof body.editorStateJson === 'string',
        editorStateJsonLength:
          typeof body.editorStateJson === 'string' ? body.editorStateJson.length : 0,
      }),
    );

    this.realtimeService.publishDocumentUpdate({
      documentId: id,
      updateBase64: body.updateBase64,
      sourceClientId: body.sourceClientId,
      ...(typeof body.editorStateJson === 'string' && body.editorStateJson.length > 0
        ? { editorStateJson: body.editorStateJson }
        : {}),
    });

    return result;
  }

  @Get(':id/members')
  listDocumentMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.listDocumentMembers(user.id, id);
  }

  @Post(':id/members')
  addDocumentMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() payload: AddDocumentMemberDto,
  ) {
    return this.documentsService
      .addDocumentMember(user.id, id, payload)
      .then((result) => {
        this.realtimeService.publishDocumentMemberUpdated({ documentId: id });
        return result;
      });
  }

  @Patch(':documentId/members/:memberId')
  updateDocumentMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('memberId') memberId: string,
    @Body() payload: UpdateDocumentMemberDto,
  ) {
    return this.documentsService
      .updateDocumentMemberRole(user.id, documentId, memberId, payload)
      .then((result) => {
        this.realtimeService.publishDocumentMemberUpdated({ documentId });
        return result;
      });
  }

  @Delete(':documentId/members/:memberId')
  removeDocumentMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.documentsService
      .removeDocumentMember(user.id, documentId, memberId)
      .then((result) => {
        this.realtimeService.publishDocumentMemberUpdated({ documentId });
        return result;
      });
  }

  @Get(':id/comments')
  listDocumentComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.listDocumentComments(user.id, id);
  }

  @Post(':id/comments')
  createDocumentComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() payload: CreateDocumentCommentDto,
  ) {
    return this.documentsService.createDocumentComment(user.id, id, payload);
  }

  @Post(':id/comments/:commentId/resolve')
  resolveDocumentComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.documentsService.resolveDocumentComment(user.id, id, commentId);
  }

  @Patch(':documentId/comments/:commentId')
  updateDocumentComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('commentId') commentId: string,
    @Body() payload: UpdateDocumentCommentDto,
  ) {
    return this.documentsService.updateDocumentComment(
      user.id,
      documentId,
      commentId,
      payload,
    );
  }

  @Delete(':id/comments/:commentId')
  deleteDocumentComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.documentsService.deleteDocumentComment(user.id, id, commentId);
  }

  @Get(':id/messages')
  listDocumentMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentMessagesService.listDocumentMessages(user.id, id);
  }

  @Post(':id/messages')
  createDocumentMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() payload: CreateDocumentMessageDto,
  ) {
    return this.documentMessagesService.createDocumentMessage(user.id, id, payload);
  }

  @Delete(':id/messages/:messageId')
  deleteDocumentMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.documentMessagesService.deleteDocumentMessage(
      user.id,
      id,
      messageId,
    );
  }

  @Get(':id/export')
  async exportDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ExportDocumentQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.documentExportService.exportDocument(
      user.id,
      id,
      query.format,
    );
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
    return new StreamableFile(result.buffer);
  }

  @Patch(':id')
  updateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() payload: UpdateDocumentDto,
  ) {
    return this.documentsService.updateDocument(user.id, id, payload);
  }

  @Delete(':id')
  softDeleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.softDeleteDocument(user.id, id);
  }

  @Get(':id')
  getDocumentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.getDocumentById(user.id, id);
  }
}
