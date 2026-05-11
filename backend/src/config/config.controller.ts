import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('runtime')
  getRuntimeConfig() {
    const { app, auth, storage, database, document } = this.appConfigService;

    return {
      app,
      database: {
        configured: Boolean(database.url),
      },
      document,
      storage: {
        endpoint: storage.endpoint,
        port: storage.port,
        useSsl: storage.useSsl,
        bucket: storage.bucket,
      },
      secrets: {
        jwtConfigured: Boolean(auth.jwtSecret),
      },
    };
  }
}
