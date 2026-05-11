import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './env/app.config';
import { AuthConfig } from './env/auth.config';
import { DatabaseConfig } from './env/database.config';
import { DocumentConfig } from './env/document.config';
import { StorageConfig } from './env/storage.config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get app(): AppConfig {
    return this.configService.getOrThrow<AppConfig>('app');
  }

  get auth(): AuthConfig {
    return this.configService.getOrThrow<AuthConfig>('auth');
  }

  get database(): DatabaseConfig {
    return this.configService.getOrThrow<DatabaseConfig>('database');
  }

  get document(): DocumentConfig {
    return this.configService.getOrThrow<DocumentConfig>('document');
  }

  get storage(): StorageConfig {
    return this.configService.getOrThrow<StorageConfig>('storage');
  }
}
