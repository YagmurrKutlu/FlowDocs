import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConfirmDocumentMediaDto } from './dto/confirm-document-media.dto';
import { PresignDocumentMediaDto } from './dto/presign-document-media.dto';
import { MediaService } from './media.service';

@Controller('documents/:documentId/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  createDocumentMediaPresign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() payload: PresignDocumentMediaDto,
  ) {
    return this.mediaService.createDocumentMediaPresign(
      user.id,
      documentId,
      payload,
    );
  }

  @Post('confirm')
  confirmDocumentMediaUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() payload: ConfirmDocumentMediaDto,
  ) {
    return this.mediaService.confirmDocumentMediaUpload(user.id, documentId, payload);
  }

  @Get(':mediaId/file')
  async streamDocumentMediaFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    await this.mediaService.streamDocumentMediaFile(
      user.id,
      documentId,
      mediaId,
      res,
    );
  }
}
