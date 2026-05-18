import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SharedController } from './shared.controller';
import { SharedService } from './shared.service';

@Module({
  imports: [PrismaModule],
  controllers: [SharedController],
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule {}
