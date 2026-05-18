import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamWorkspaceDto } from './dto/create-team-workspace.dto';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto';

const INVITE_STATUS_PENDING = 'PENDING';
const INVITE_STATUS_ACCEPTED = 'ACCEPTED';
const INVITE_STATUS_CANCELLED = 'CANCELLED';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(userId: string, payload: CreateTeamWorkspaceDto) {
    const name = payload.name.trim();

    if (name.length < 2) {
      throw new BadRequestException(
        'Workspace name must be at least 2 characters.',
      );
    }

    const duplicate = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: {
          name: { equals: name, mode: 'insensitive' },
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Bu isimde bir çalışma alanınız zaten var.');
    }

    const slug = await this.generateUniqueSlug(name);

    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
        include: {
          _count: {
            select: {
              members: true,
              documents: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: created.id,
          actorId: userId,
          type: ActivityType.WORKSPACE_CREATED,
        },
      });

      return created;
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        role: WorkspaceRole.OWNER,
        memberCount: workspace._count.members,
        documentCount: workspace._count.documents,
        updatedAt: workspace.updatedAt,
      },
    };
  }

  async getOverview(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            updatedAt: true,
            _count: {
              select: {
                members: true,
                documents: true,
              },
            },
          },
        },
      },
      orderBy: { workspace: { updatedAt: 'desc' } },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      memberCount: m.workspace._count.members,
      documentCount: m.workspace._count.documents,
      updatedAt: m.workspace.updatedAt,
    }));

    const currentWorkspace = workspaces[0] ?? null;

    const workspaceIds = workspaces.map((w) => w.id);
    let totalMembers = 0;
    let totalDocuments = 0;

    if (workspaceIds.length > 0) {
      const [memberAgg, documentAgg] = await Promise.all([
        this.prisma.workspaceMember.groupBy({
          by: ['workspaceId'],
          where: { workspaceId: { in: workspaceIds } },
          _count: { _all: true },
        }),
        this.prisma.document.groupBy({
          by: ['workspaceId'],
          where: { workspaceId: { in: workspaceIds }, deletedAt: null },
          _count: { _all: true },
        }),
      ]);
      totalMembers = memberAgg.reduce((sum, row) => sum + row._count._all, 0);
      totalDocuments = documentAgg.reduce(
        (sum, row) => sum + row._count._all,
        0,
      );
    }

    return {
      workspaces,
      currentWorkspace,
      stats: {
        totalWorkspaces: workspaces.length,
        totalMembers,
        totalDocuments,
        activeCollaborators: null,
      },
    };
  }

  async listMembers(userId: string, workspaceId: string) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
            email: true,
            sessions: {
              where: { revokedAt: null },
              orderBy: { lastSeenAt: 'desc' },
              take: 1,
              select: { lastSeenAt: true },
            },
          },
        },
      },
    });

    return {
      members: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.user.fullName,
        email: row.user.email,
        role: row.role,
        joinedAt: row.createdAt,
        lastActiveAt: row.user.sessions[0]?.lastSeenAt ?? null,
        status: 'unknown' as const,
      })),
    };
  }

  async listDocuments(userId: string, workspaceId: string) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const documents = await this.prisma.document.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
    });

    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        memberCount: doc._count.members,
        status: 'available' as const,
      })),
    };
  }

  async listInvites(userId: string, workspaceId: string) {
    await this.assertWorkspaceOwner(userId, workspaceId);

    const invites = await this.prisma.workspaceInvite.findMany({
      where: { workspaceId, status: INVITE_STATUS_PENDING },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        invitedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return {
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
        invitedBy: {
          id: invite.invitedBy.id,
          name: invite.invitedBy.fullName,
          email: invite.invitedBy.email,
        },
      })),
    };
  }

  async createInvite(
    userId: string,
    workspaceId: string,
    payload: CreateWorkspaceInviteDto,
  ) {
    await this.assertWorkspaceOwner(userId, workspaceId);

    const email = payload.email.trim().toLowerCase();

    if (payload.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('OWNER role cannot be assigned via invite.');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (actor?.email.trim().toLowerCase() === email) {
      throw new ConflictException('Kendinizi tekrar davet edemezsiniz.');
    }

    const existingMember = await this.prisma.user.findFirst({
      where: {
        email,
        workspaceMembers: { some: { workspaceId } },
      },
      select: { id: true },
    });

    if (existingMember) {
      throw new ConflictException(
        'Bu kullanıcı zaten bu çalışma alanının üyesi.',
      );
    }

    const pending = await this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceId,
        email,
        status: INVITE_STATUS_PENDING,
      },
      select: { id: true },
    });

    if (pending) {
      throw new ConflictException(
        'Bu e-posta için bekleyen bir davet zaten var.',
      );
    }

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role: payload.role,
        invitedById: userId,
        status: INVITE_STATUS_PENDING,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId,
        actorId: userId,
        type: ActivityType.USER_INVITED,
        metadata: { email, role: payload.role } as Prisma.InputJsonValue,
      },
    });

    return { invite };
  }

  async cancelInvite(
    userId: string,
    workspaceId: string,
    inviteId: string,
  ) {
    await this.assertWorkspaceOwner(userId, workspaceId);

    const invite = await this.prisma.workspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found.');
    }

    if (invite.status !== INVITE_STATUS_PENDING) {
      throw new BadRequestException('Only pending invites can be cancelled.');
    }

    const updated = await this.prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: {
        status: INVITE_STATUS_CANCELLED,
        cancelledAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        cancelledAt: true,
      },
    });

    return { invite: updated };
  }

  async acceptInviteDemo(
    userId: string,
    workspaceId: string,
    inviteId: string,
  ) {
    this.assertDemoInviteAcceptEnabled();
    await this.assertWorkspaceOwner(userId, workspaceId);

    const invite = await this.prisma.workspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found.');
    }

    if (invite.status !== INVITE_STATUS_PENDING) {
      throw new BadRequestException('Only pending invites can be accepted.');
    }

    const email = invite.email.trim().toLowerCase();
    const invitedUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, fullName: true, email: true },
    });

    if (!invitedUser) {
      throw new NotFoundException(
        'Bu e-postaya ait kayıtlı kullanıcı bulunamadı.',
      );
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: invitedUser.id },
      },
      select: { id: true },
    });

    if (existingMember) {
      throw new ConflictException(
        'Bu kullanıcı zaten bu çalışma alanının üyesi.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitedUser.id,
          role: invite.role,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              fullName: true,
              email: true,
              sessions: {
                where: { revokedAt: null },
                orderBy: { lastSeenAt: 'desc' },
                take: 1,
                select: { lastSeenAt: true },
              },
            },
          },
        },
      });

      const updatedInvite = await tx.workspaceInvite.update({
        where: { id: inviteId },
        data: {
          status: INVITE_STATUS_ACCEPTED,
          acceptedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          actorId: userId,
          type: ActivityType.USER_INVITED,
          metadata: {
            email,
            role: invite.role,
            acceptedDemo: true,
            userId: invitedUser.id,
          } as Prisma.InputJsonValue,
        },
      });

      return { member, invite: updatedInvite };
    });

    return {
      member: {
        id: result.member.id,
        userId: result.member.userId,
        name: result.member.user.fullName,
        email: result.member.user.email,
        role: result.member.role,
        joinedAt: result.member.createdAt,
        lastActiveAt: result.member.user.sessions[0]?.lastSeenAt ?? null,
        status: 'unknown' as const,
      },
      invite: result.invite,
    };
  }

  async updateMemberRole(
    userId: string,
    workspaceId: string,
    memberId: string,
    payload: UpdateWorkspaceMemberRoleDto,
  ) {
    await this.assertWorkspaceOwner(userId, workspaceId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true, userId: true, role: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    if (member.userId === userId && payload.role !== WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'You cannot change your own owner role.',
      );
    }

    if (
      member.role === WorkspaceRole.OWNER &&
      payload.role !== WorkspaceRole.OWNER
    ) {
      const ownerCount = await this.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot change role of the last workspace owner.',
        );
      }
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: payload.role },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    return {
      member: {
        id: updated.id,
        userId: updated.userId,
        name: updated.user.fullName,
        email: updated.user.email,
        role: updated.role,
        joinedAt: updated.createdAt,
      },
    };
  }

  async removeMember(
    userId: string,
    workspaceId: string,
    memberId: string,
  ) {
    await this.assertWorkspaceOwner(userId, workspaceId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true, userId: true, role: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    if (member.userId === userId) {
      throw new BadRequestException('You cannot remove yourself from the workspace.');
    }

    if (member.role === WorkspaceRole.OWNER) {
      const ownerCount = await this.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last workspace owner.',
        );
      }
    }

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });

    return { success: true };
  }

  async getActivity(userId: string, workspaceId: string) {
    await this.assertWorkspaceMember(userId, workspaceId);

    const logs = await this.prisma.activityLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        type: true,
        createdAt: true,
        metadata: true,
        actor: { select: { fullName: true } },
        document: { select: { title: true } },
      },
    });

    const activities = logs.map((log) =>
      this.mapActivityLog(log),
    );

    if (activities.length > 0) {
      return { activities };
    }

    const [recentDocs, recentInvites, recentMembers] = await Promise.all([
      this.prisma.document.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          createdBy: { select: { fullName: true } },
        },
      }),
      this.prisma.workspaceInvite.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          createdAt: true,
          invitedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
    ]);

    const derived = [
      ...recentDocs.map((doc) => ({
        id: `doc-${doc.id}`,
        type: 'DOCUMENT_CREATED',
        title: 'Doküman oluşturuldu',
        description: doc.title,
        actorName: doc.createdBy.fullName,
        createdAt: doc.createdAt,
      })),
      ...recentInvites.map((invite) => ({
        id: `invite-${invite.id}`,
        type: 'USER_INVITED',
        title: 'Davet oluşturuldu',
        description: invite.email,
        actorName: invite.invitedBy.fullName,
        createdAt: invite.createdAt,
      })),
      ...recentMembers.map((member) => ({
        id: `member-${member.id}`,
        type: 'MEMBER_JOINED',
        title: 'Üye katıldı',
        description: member.user.fullName,
        actorName: member.user.fullName,
        createdAt: member.createdAt,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 20);

    return { activities: derived };
  }

  async assertWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRole> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const role = await this.getWorkspaceRole(userId, workspaceId);
    if (!role) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    return role;
  }

  async assertWorkspaceOwner(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const role = await this.assertWorkspaceMember(userId, workspaceId);
    if (role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        'Only workspace owners can perform this action.',
      );
    }
  }

  async getWorkspaceRole(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRole | null> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { role: true },
    });

    return membership?.role ?? null;
  }

  async countWorkspaceOwners(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { workspaceId, role: WorkspaceRole.OWNER },
    });
  }

  private assertDemoInviteAcceptEnabled(): void {
    const allowed =
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_DEMO_INVITE_ACCEPT === 'true';

    if (!allowed) {
      throw new ForbiddenException('Demo invite acceptance is disabled.');
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

  private mapActivityLog(log: {
    id: string;
    type: ActivityType;
    createdAt: Date;
    metadata: Prisma.JsonValue;
    actor: { fullName: string };
    document: { title: string } | null;
  }) {
    const meta =
      log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : {};

    const email =
      typeof meta.email === 'string' ? meta.email : undefined;

    switch (log.type) {
      case ActivityType.WORKSPACE_CREATED:
        return {
          id: log.id,
          type: log.type,
          title: 'Çalışma alanı oluşturuldu',
          description: 'Yeni çalışma alanı',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      case ActivityType.WORKSPACE_UPDATED:
        return {
          id: log.id,
          type: log.type,
          title: 'Çalışma alanı güncellendi',
          description: 'Ayarlar değiştirildi',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      case ActivityType.DOCUMENT_CREATED:
        return {
          id: log.id,
          type: log.type,
          title: 'Doküman oluşturuldu',
          description: log.document?.title ?? 'Doküman',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      case ActivityType.DOCUMENT_UPDATED: {
        const action =
          typeof meta.action === 'string' ? meta.action : undefined;
        const docTitle =
          log.document?.title ??
          (typeof meta.title === 'string' ? meta.title : 'Doküman');

        if (action === 'moved_to_trash') {
          return {
            id: log.id,
            type: log.type,
            title: `${docTitle} çöp kutusuna taşındı`,
            description: docTitle,
            actorName: log.actor.fullName,
            createdAt: log.createdAt,
          };
        }
        if (action === 'restored') {
          return {
            id: log.id,
            type: log.type,
            title: `${docTitle} geri yüklendi`,
            description: docTitle,
            actorName: log.actor.fullName,
            createdAt: log.createdAt,
          };
        }
        if (action === 'permanently_deleted') {
          const permanentTitle =
            typeof meta.title === 'string' && meta.title.trim()
              ? `${meta.title} kalıcı olarak silindi`
              : 'Bir doküman kalıcı olarak silindi';
          return {
            id: log.id,
            type: log.type,
            title: permanentTitle,
            description: log.actor.fullName,
            actorName: log.actor.fullName,
            createdAt: log.createdAt,
          };
        }

        return {
          id: log.id,
          type: log.type,
          title: 'Doküman güncellendi',
          description: docTitle,
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      }
      case ActivityType.DOCUMENT_SHARED:
        return {
          id: log.id,
          type: log.type,
          title: 'Doküman paylaşıldı',
          description: log.document?.title ?? 'Doküman',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      case ActivityType.USER_INVITED:
        return {
          id: log.id,
          type: log.type,
          title: 'Davet gönderildi',
          description: email ?? 'E-posta daveti',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      case ActivityType.MEDIA_UPLOADED:
        return {
          id: log.id,
          type: log.type,
          title: 'Dosya yüklendi',
          description: 'Medya dosyası',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
      default:
        return {
          id: log.id,
          type: log.type,
          title: 'Etkinlik',
          description: '',
          actorName: log.actor.fullName,
          createdAt: log.createdAt,
        };
    }
  }
}
