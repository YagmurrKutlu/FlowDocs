import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  UNKNOWN_LOCATION_LABEL,
  extractClientIp,
  maskIpAddress,
  parseUserAgent,
} from './session-client.util';

export interface ProfileSessionDto {
  id: string;
  device: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  location: string;
  ipMasked: string;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastActiveLabel: string;
}

@Injectable()
export class UserSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSessionForUser(userId: string, request: Request): Promise<string> {
    const userAgentHeader = request.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : undefined;
    const parsed = parseUserAgent(userAgent);
    const ipAddress = extractClientIp(request);

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        userAgent: userAgent ?? null,
        ipAddress,
        browser: parsed.browser,
        os: parsed.os,
        deviceLabel: parsed.deviceLabel,
        location: UNKNOWN_LOCATION_LABEL,
      },
    });

    return session.id;
  }

  async assertSessionActive(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!session) {
      throw new ForbiddenException('Session is no longer valid.');
    }
  }

  async touchSession(sessionId: string, userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  async listActiveSessionsForUser(
    userId: string,
    currentSessionId: string,
  ): Promise<ProfileSessionDto[]> {
    await this.touchSession(currentSessionId, userId);

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: {
        lastSeenAt: 'desc',
      },
    });

    return sessions.map((session) => this.mapSession(session, currentSessionId));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<{ revoked: boolean }> {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('Current session cannot be revoked from this screen.');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { revoked: true };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revokedCount: number }> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentSessionId },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revokedCount: result.count };
  }

  private mapSession(
    session: {
      id: string;
      deviceLabel: string | null;
      browser: string | null;
      os: string | null;
      location: string | null;
      ipAddress: string | null;
      createdAt: Date;
      lastSeenAt: Date;
    },
    currentSessionId: string,
  ): ProfileSessionDto {
    const deviceLabel =
      session.deviceLabel ??
      `${session.os ?? 'Unknown OS'} · ${session.browser ?? 'Unknown Browser'}`;

    return {
      id: session.id,
      device: deviceLabel,
      deviceLabel,
      browser: session.browser,
      os: session.os,
      location: session.location ?? UNKNOWN_LOCATION_LABEL,
      ipMasked: maskIpAddress(session.ipAddress),
      isCurrent: session.id === currentSessionId,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      lastActiveLabel: this.formatRelativeTime(session.lastSeenAt),
    };
  }

  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Bugün · ${date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    const days = Math.floor(hours / 24);
    if (days === 1) {
      return `Dün · ${date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return `${days} gün önce`;
  }
}
