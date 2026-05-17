import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DocumentExportService } from './document-export.service';
import { DocumentYjsPersistenceService } from './document-yjs-persistence.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, RealtimeModule, MediaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentYjsPersistenceService, DocumentExportService],
})
export class DocumentsModule {}
