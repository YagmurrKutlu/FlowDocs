import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BulkTrashActionDto } from './dto/bulk-trash-action.dto';
import { ListTrashDocumentsQueryDto } from './dto/list-trash-documents-query.dto';
import { TrashService } from './trash.service';

@Controller('trash')
@UseGuards(JwtAuthGuard)
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.trashService.getSummary(user.id);
  }

  @Get('documents')
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTrashDocumentsQueryDto,
  ) {
    return this.trashService.listDocuments(user.id, query);
  }

  @Post('documents/:documentId/restore')
  restoreDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.trashService.restoreDocument(user.id, documentId);
  }

  @Delete('documents/:documentId/permanent')
  permanentDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.trashService.permanentDeleteDocument(user.id, documentId);
  }

  @Post('documents/bulk-restore')
  bulkRestore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BulkTrashActionDto,
  ) {
    return this.trashService.bulkRestore(user.id, body);
  }

  @Post('documents/bulk-permanent-delete')
  bulkPermanentDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BulkTrashActionDto,
  ) {
    return this.trashService.bulkPermanentDelete(user.id, body);
  }
}
