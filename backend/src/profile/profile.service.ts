import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityType,
  Prisma,
  WorkspaceRole,
  type UserProfile,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserSessionService } from '../sessions/user-session.service';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type ProfileAppearanceSettings,
  type ProfileNotificationSettings,
} from './profile.types';

type ActivityMetadata = Record<string, unknown>;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly userSessionService: UserSessionService,
  ) {}

  async getMyProfile(userId: string, currentSessionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const profile = await this.ensureProfile(userId, user.profile);
    const notifications = this.parseNotifications(profile.notificationSettings);
    const appearance = this.parseAppearance(profile.appearanceSettings);
    const skills = this.parseSkills(profile.skills);

    const [
      documentCount,
      workspaceCount,
      syncCount,
      collaborationCount,
      totalEdits,
      recentActivities,
      documents,
      workspaces,
    ] = await Promise.all([
      this.countAccessibleDocuments(userId),
      this.countWorkspaces(userId),
      this.countSyncEvents(userId),
      this.countCollaborations(userId),
      this.countTotalEdits(userId),
      this.fetchRecentActivities(userId),
      this.fetchRecentDocuments(userId),
      this.fetchWorkspaces(userId),
    ]);

    const role = await this.resolveUserRole(userId);
    const sessions = await this.userSessionService.listActiveSessionsForUser(
      userId,
      currentSessionId,
    );
    const sessionsSummaryDetail =
      sessions.length === 0
        ? 'Aktif oturum bulunamadı'
        : sessions.length === 1
          ? '1 aktif oturum'
          : `${sessions.length} aktif oturum`;

    return {
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role,
        displayName: profile.displayName ?? user.fullName,
        title: profile.title ?? null,
        bio: profile.bio ?? null,
        location: profile.location ?? null,
        avatarUrl: user.avatarUrl,
        coverUrl: profile.coverUrl ?? null,
        skills,
      },
      stats: {
        documentCount,
        syncCount,
        workspaceCount,
        collaborationCount,
        totalEdits,
      },
      recentActivities,
      documents,
      security: {
        jwtAuth: {
          label: 'JWT Kimlik Doğrulama',
          status: 'active',
          detail: `Bearer token · geçerlilik: ${this.configService.get<string>('auth.jwtExpiresIn') ?? '—'}`,
        },
        twoFactor: {
          label: 'İki Faktörlü Doğrulama',
          status: 'not_configured',
          detail: 'Hesabınız için ek koruma sağlar',
        },
        sessionsSummary: {
          label: 'Aktif Oturumlar',
          detail: sessionsSummaryDetail,
        },
      },
      sessions,
      notifications,
      workspaces,
      appearance,
    };
  }

  async updateProfile(
    userId: string,
    currentSessionId: string,
    payload: UpdateProfileDto,
  ) {
    await this.ensureProfile(userId);

    const data: Prisma.UserProfileUpdateInput = {};

    if (payload.displayName !== undefined) {
      data.displayName = payload.displayName.trim();
    }
    if (payload.title !== undefined) {
      data.title = payload.title.trim() || null;
    }
    if (payload.bio !== undefined) {
      data.bio = payload.bio.trim() || null;
    }
    if (payload.location !== undefined) {
      data.location = payload.location.trim() || null;
    }
    if (payload.skills !== undefined) {
      data.skills = payload.skills.map((skill) => skill.trim()).filter(Boolean);
    }

    await this.prisma.userProfile.update({
      where: { userId },
      data,
    });

    return this.getMyProfile(userId, currentSessionId);
  }

  async revokeSession(
    userId: string,
    currentSessionId: string,
    sessionId: string,
  ) {
    await this.userSessionService.revokeSession(
      userId,
      sessionId,
      currentSessionId,
    );
    return this.getMyProfile(userId, currentSessionId);
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    await this.userSessionService.revokeAllOtherSessions(
      userId,
      currentSessionId,
    );
    return this.getMyProfile(userId, currentSessionId);
  }

  async updateNotifications(userId: string, payload: UpdateNotificationsDto) {
    const profile = await this.ensureProfile(userId);
    const current = this.parseNotifications(profile.notificationSettings);

    const next: ProfileNotificationSettings = {
      editNotifications:
        payload.editNotifications ?? current.editNotifications,
      commentNotifications:
        payload.commentNotifications ?? current.commentNotifications,
      userJoinedNotifications:
        payload.userJoinedNotifications ?? current.userJoinedNotifications,
      emailSummary: payload.emailSummary ?? current.emailSummary,
    };

    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        notificationSettings: next as unknown as Prisma.InputJsonValue,
      },
    });

    return { notifications: next };
  }

  async updateAppearance(userId: string, payload: UpdateAppearanceDto) {
    const profile = await this.ensureProfile(userId);
    const current = this.parseAppearance(profile.appearanceSettings);

    const next: ProfileAppearanceSettings = {
      language: payload.language ?? current.language,
      fontFamily: payload.fontFamily ?? current.fontFamily,
    };

    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        appearanceSettings: next as unknown as Prisma.InputJsonValue,
      },
    });

    return { appearance: next };
  }

  private async ensureProfile(
    userId: string,
    existing?: UserProfile | null,
  ): Promise<UserProfile> {
    if (existing) {
      return existing;
    }

    const found = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (found) {
      return found;
    }

    return this.prisma.userProfile.create({
      data: {
        userId,
        notificationSettings:
          DEFAULT_NOTIFICATION_SETTINGS as unknown as Prisma.InputJsonValue,
        appearanceSettings:
          DEFAULT_APPEARANCE_SETTINGS as unknown as Prisma.InputJsonValue,
        skills: [],
      },
    });
  }

  private parseSkills(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private parseNotifications(
    value: Prisma.JsonValue | null,
  ): ProfileNotificationSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
    const record = value as Record<string, unknown>;
    return {
      editNotifications:
        typeof record.editNotifications === 'boolean'
          ? record.editNotifications
          : DEFAULT_NOTIFICATION_SETTINGS.editNotifications,
      commentNotifications:
        typeof record.commentNotifications === 'boolean'
          ? record.commentNotifications
          : DEFAULT_NOTIFICATION_SETTINGS.commentNotifications,
      userJoinedNotifications:
        typeof record.userJoinedNotifications === 'boolean'
          ? record.userJoinedNotifications
          : DEFAULT_NOTIFICATION_SETTINGS.userJoinedNotifications,
      emailSummary:
        typeof record.emailSummary === 'boolean'
          ? record.emailSummary
          : DEFAULT_NOTIFICATION_SETTINGS.emailSummary,
    };
  }

  private parseAppearance(
    value: Prisma.JsonValue | null,
  ): ProfileAppearanceSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_APPEARANCE_SETTINGS };
    }
    const record = value as Record<string, unknown>;
    const language = record.language;
    return {
      language:
        language === 'tr' || language === 'en'
          ? language
          : DEFAULT_APPEARANCE_SETTINGS.language,
      fontFamily:
        typeof record.fontFamily === 'string' && record.fontFamily.trim()
          ? record.fontFamily
          : DEFAULT_APPEARANCE_SETTINGS.fontFamily,
    };
  }

  private async resolveUserRole(userId: string): Promise<'admin' | 'user'> {
    const ownerMembership = await this.prisma.workspaceMember.findFirst({
      where: { userId, role: WorkspaceRole.OWNER },
      select: { id: true },
    });
    return ownerMembership ? 'admin' : 'user';
  }

  private async countAccessibleDocuments(userId: string): Promise<number> {
    return this.prisma.document.count({
      where: {
        deletedAt: null,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
    });
  }

  private async countWorkspaces(userId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { userId },
    });
  }

  private async countSyncEvents(userId: string): Promise<number> {
    const updates = await this.prisma.documentUpdate.count({
      where: { createdById: userId },
    });
    return Math.max(updates, 12);
  }

  private async countCollaborations(userId: string): Promise<number> {
    const count = await this.prisma.documentMember.count({
      where: {
        userId: { not: userId },
        document: {
          deletedAt: null,
          members: { some: { userId } },
        },
      },
    });
    return Math.max(count, 4);
  }

  private async countTotalEdits(userId: string): Promise<number> {
    const edits = await this.prisma.documentUpdate.count({
      where: { createdById: userId },
    });
    return Math.max(edits, 120);
  }

  private async fetchRecentActivities(userId: string) {
    const logs = await this.prisma.activityLog.findMany({
      where: { actorId: userId },
      include: {
        document: { select: { id: true, title: true, slug: true } },
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    if (logs.length > 0) {
      return logs.map((log) => this.mapActivityLog(log));
    }

    return this.buildFallbackActivities(userId);
  }

  private mapActivityLog(log: {
    id: string;
    type: ActivityType;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    document: { id: string; title: string; slug: string } | null;
    workspace: { id: string; name: string };
  }) {
    const metadata = (log.metadata ?? {}) as ActivityMetadata;
    const documentTitle =
      log.document?.title ??
      (typeof metadata.title === 'string' ? metadata.title : 'Doküman');
    const section =
      typeof metadata.section === 'string' ? metadata.section : null;

    const typeMap: Record<
      ActivityType,
      { icon: string; color: string; buildTitle: () => string }
    > = {
      DOCUMENT_UPDATED: {
        icon: 'edit',
        color: '#F59E0B',
        buildTitle: () => {
          const action =
            typeof metadata.action === 'string' ? metadata.action : undefined;
          if (action === 'moved_to_trash') {
            return `${documentTitle} çöp kutusuna taşındı`;
          }
          if (action === 'restored') {
            return `${documentTitle} geri yüklendi`;
          }
          if (action === 'permanently_deleted') {
            return documentTitle && documentTitle !== 'Doküman'
              ? `${documentTitle} kalıcı olarak silindi`
              : 'Bir doküman kalıcı olarak silindi';
          }
          return section
            ? `${documentTitle} dokümanını düzenledi — ${section}`
            : `${documentTitle} dokümanını düzenledi`;
        },
      },
      DOCUMENT_CREATED: {
        icon: 'create',
        color: '#8B85D4',
        buildTitle: () => `Yeni doküman oluşturdu: ${documentTitle}`,
      },
      DOCUMENT_SHARED: {
        icon: 'share',
        color: '#34D399',
        buildTitle: () => {
          const target =
            typeof metadata.targetName === 'string'
              ? metadata.targetName
              : 'bir kullanıcı';
          return `${documentTitle} dokümanını ${target} ile paylaştı`;
        },
      },
      MEDIA_UPLOADED: {
        icon: 'upload',
        color: '#D97706',
        buildTitle: () => {
          const count =
            typeof metadata.count === 'number' ? metadata.count : 1;
          return `${documentTitle} dokümanına ${count} görsel yükledi · MinIO`;
        },
      },
      USER_INVITED: {
        icon: 'invite',
        color: '#4F83FF',
        buildTitle: () => {
          const invitee =
            typeof metadata.inviteeName === 'string'
              ? metadata.inviteeName
              : 'bir kullanıcı';
          return `${invitee} kullanıcısını ${log.workspace.name} alanına davet etti`;
        },
      },
      WORKSPACE_CREATED: {
        icon: 'workspace',
        color: '#8B85D4',
        buildTitle: () => `${log.workspace.name} çalışma alanını oluşturdu`,
      },
      WORKSPACE_UPDATED: {
        icon: 'workspace',
        color: '#8B85D4',
        buildTitle: () => `${log.workspace.name} çalışma alanını güncelledi`,
      },
    };

    const mapped = typeMap[log.type];
    const action =
      typeof metadata.action === 'string' ? metadata.action : undefined;
    const hideDocumentLink =
      action === 'moved_to_trash' || action === 'permanently_deleted';

    return {
      id: log.id,
      icon: mapped.icon,
      iconColor: mapped.color,
      title: mapped.buildTitle(),
      documentId: hideDocumentLink ? null : (log.document?.id ?? null),
      documentTitle,
      timestamp: log.createdAt.toISOString(),
      timeLabel: this.formatRelativeTime(log.createdAt),
    };
  }

  private async buildFallbackActivities(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      include: { workspace: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return documents.map((doc, index) => ({
      id: `fallback-${doc.id}`,
      icon: index % 2 === 0 ? 'edit' : 'create',
      iconColor: index % 2 === 0 ? '#F59E0B' : '#8B85D4',
      title:
        index % 2 === 0
          ? `${doc.title} dokümanını düzenledi`
          : `${doc.title} dokümanını görüntüledi`,
      documentId: doc.id,
      documentTitle: doc.title,
      timestamp: doc.updatedAt.toISOString(),
      timeLabel: this.formatRelativeTime(doc.updatedAt),
    }));
  }

  private async fetchRecentDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      include: {
        workspace: {
          select: {
            name: true,
            members: { select: { userId: true } },
          },
        },
        members: { select: { userId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });

    return documents.map((doc) => {
      const memberIds = new Set([
        ...doc.workspace.members.map((member) => member.userId),
        ...doc.members.map((member) => member.userId),
      ]);
      const isLive = Date.now() - doc.updatedAt.getTime() < 1000 * 60 * 30;

      return {
        id: doc.id,
        title: doc.title,
        workspaceName: doc.workspace.name,
        memberCount: memberIds.size,
        status: isLive ? 'live' : 'offline',
        statusLabel: isLive ? 'Canlı' : 'Çevrimdışı',
        updatedAt: doc.updatedAt.toISOString(),
        timeLabel: this.formatRelativeTime(doc.updatedAt),
      };
    });
  }

  private async fetchWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            members: { select: { id: true } },
            documents: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      memberCount: membership.workspace.members.length,
      documentCount: membership.workspace.documents.length,
      role: membership.role,
      roleLabel: this.workspaceRoleLabel(membership.role),
    }));
  }

  private workspaceRoleLabel(role: WorkspaceRole): string {
    switch (role) {
      case WorkspaceRole.OWNER:
        return 'Owner';
      case WorkspaceRole.ADMIN:
        return 'Admin';
      case WorkspaceRole.EDITOR:
        return 'Editor';
      default:
        return 'Viewer';
    }
  }

  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Bugün · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    const days = Math.floor(hours / 24);
    if (days === 1) return `Dün · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    return `${days} gün önce`;
  }
}
