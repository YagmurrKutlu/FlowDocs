import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { DocumentsModule } from './documents/documents.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { MediaModule } from './media/media.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PresenceModule } from './presence/presence.module';
import { ActivityModule } from './activity/activity.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import appConfig from './config/env/app.config';
import authConfig from './config/env/auth.config';
import databaseConfig from './config/env/database.config';
import documentConfig from './config/env/document.config';
import storageConfig from './config/env/storage.config';
import { envValidationSchema } from './config/env/env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        documentConfig,
        storageConfig,
      ],
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    DocumentsModule,
    CollaboratorsModule,
    MediaModule,
    RealtimeModule,
    PresenceModule,
    ActivityModule,
    HealthModule,
    CommonModule,
    ConfigModule,
    PrismaModule,
  ],
})
export class AppModule {}
