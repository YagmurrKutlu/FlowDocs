import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(userId: string, payload: CreateWorkspaceDto) {
    const name = payload.name.trim();
    const description = payload.description?.trim() || null;
    const slug = await this.generateUniqueSlug(name);

    const workspace = await this.prisma.$transaction(async (tx) => {
      const createdWorkspace = await tx.workspace.create({
        data: {
          name,
          description,
          slug,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
        include: workspaceDetailInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId: createdWorkspace.id,
          actorId: userId,
          type: ActivityType.WORKSPACE_CREATED,
        },
      });

      return createdWorkspace;
    });

    return {
      workspace: this.mapWorkspace(workspace, userId),
    };
  }

  async listUserWorkspaces(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: workspaceDetailInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      workspaces: workspaces.map((workspace) =>
        this.mapWorkspace(workspace, userId),
      ),
    };
  }

  async getWorkspaceById(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: workspaceDetailInclude,
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const membership = workspace.members.find(
      (member) => member.userId === userId,
    );

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    return {
      workspace: this.mapWorkspace(workspace, userId),
    };
  }

  async listWorkspaceMembers(userId: string, workspaceId: string) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    return {
      members: rows.map((row) => ({
        userId: row.userId,
        email: row.user.email,
        fullName: row.user.fullName,
        role: row.role,
        createdAt: row.createdAt,
      })),
    };
  }

  async addWorkspaceMember(
    actorUserId: string,
    workspaceId: string,
    payload: AddWorkspaceMemberDto,
  ) {
    const actorMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: actorUserId,
        },
      },
      select: { role: true },
    });

    if (!actorMembership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    if (
      actorMembership.role !== WorkspaceRole.OWNER &&
      actorMembership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only workspace owners and admins can add members.',
      );
    }

    const workspaceExists = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspaceExists) {
      throw new NotFoundException('Workspace not found.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundException(
        'No active user is registered with this email address.',
      );
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'This user is already a member of this workspace.',
      );
    }

    const created = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: payload.role,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    return {
      membership: {
        id: created.id,
        userId: created.userId,
        email: created.user.email,
        fullName: created.user.fullName,
        role: created.role,
        createdAt: created.createdAt,
      },
    };
  }

  private async assertWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.workspace.findUnique({ where: { slug: candidate } })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private slugify(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
  }

  private mapWorkspace(workspace: WorkspaceWithRelations, userId: string) {
    const membership = workspace.members.find(
      (member) => member.userId === userId,
    );

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      role: membership?.role ?? WorkspaceRole.VIEWER,
      owner: workspace.owner,
      memberCount: workspace.members.length,
    };
  }
}

const workspaceDetailInclude = {
  owner: {
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
    },
  },
  members: {
    select: {
      userId: true,
      role: true,
    },
  },
} satisfies Prisma.WorkspaceInclude;

type WorkspaceWithRelations = Prisma.WorkspaceGetPayload<{
  include: typeof workspaceDetailInclude;
}>;
