import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { ApplyDocumentUpdateDto } from './dto/apply-document-update.dto';
import { AddDocumentMemberDto } from './dto/add-document-member.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentCommentDto } from './dto/update-document-comment.dto';
import { UpdateDocumentMemberDto } from './dto/update-document-member.dto';
import { DocumentYjsPersistenceService } from './document-yjs-persistence.service';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentYjsPersistence: DocumentYjsPersistenceService,
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

  @Get(':id/state')
  getDocumentState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentYjsPersistence.getDocumentState(user.id, id);
  }

  @Post(':id/updates')
  async applyDocumentUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ApplyDocumentUpdateDto,
  ) {
    const result = await this.documentYjsPersistence.applyUpdate(
      user.id,
      id,
      body.updateBase64,
      body.sourceClientId,
      body.editorStateJson,
    );

    this.realtimeService.publishDocumentUpdate({
      documentId: id,
      updateBase64: body.updateBase64,
      sourceClientId: body.sourceClientId,
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

  @Get(':id')
  getDocumentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.getDocumentById(user.id, id);
  }
}
