import { ActivityType } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logWorkspaceCreated(params: {
    workspaceId: string;
    actorId: string;
  }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        type: ActivityType.WORKSPACE_CREATED,
      },
    });
  }
}
