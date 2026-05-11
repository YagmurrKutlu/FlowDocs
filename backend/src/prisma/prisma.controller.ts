import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('prisma')
export class PrismaController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get('status')
  async getStatus() {
    await this.prismaService.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
