import {
  Ack,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserSessionService } from '../sessions/user-session.service';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

interface JwtPayload {
  sub: string;
  email: string;
  sessionId?: string;
}

interface JoinDocumentPayload {
  documentId: string;
}

interface LeaveDocumentPayload {
  documentId: string;
}

interface CursorUpdatePayload {
  documentId: string;
  color: string;
  anchorOffset: number;
  focusOffset: number;
}

interface DocumentMessageTypingPayload {
  documentId: string;
  isTyping: boolean;
}

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    user?: AuthenticatedUser;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly userSessionService: UserSessionService,
  ) {}

  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    this.realtimeService.attachServer(this.server);
    try {
      const user = await this.resolveSocketUser(client);
      this.logger.debug(`Socket connected: ${client.id} user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.realtimeService.removeSocketFromAllRooms(client.id);
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_document')
  async handleJoinDocument(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinDocumentPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    try {
      const user = await this.resolveSocketUser(client);

      const documentId = payload?.documentId?.trim();
      if (!documentId) {
        throw new WsException('documentId is required.');
      }

      const hasAccess = await this.assertDocumentReadAccess(user.id, documentId);
      if (!hasAccess) {
        throw new WsException('You do not have access to this document.');
      }

      await client.join(this.roomName(documentId));
      const activeUsers = this.realtimeService.joinDocumentRoom({
        documentId,
        socketId: client.id,
        user: { userId: user.id, fullName: user.fullName },
      });

      const response = { ok: true, documentId, activeUsers };
      this.logger.debug(
        `join_document success user:${user.id} socket:${client.id} document:${documentId} activeUsers:${activeUsers.length}`,
      );
      ack?.(response);
      return response;
    } catch (error) {
      const message =
        error instanceof WsException
          ? (error.getError() as string)
          : error instanceof Error
            ? error.message
            : 'Failed to join document.';

      this.logger.warn(
        `join_document failure socket:${client.id} error:${message}`,
      );
      ack?.({ ok: false, error: message });
      throw error;
    }
  }

  @SubscribeMessage('leave_document')
  async handleLeaveDocument(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveDocumentPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const documentId = payload?.documentId?.trim();
    if (!documentId) {
      const response = { ok: true };
      this.logger.debug(`leave_document socket:${client.id} document:<none>`);
      ack?.(response);
      return response;
    }

    await client.leave(this.roomName(documentId));
    const activeUsers = this.realtimeService.leaveDocumentRoom(documentId, client.id);
    const response = { ok: true, documentId, activeUsers };
    this.logger.debug(
      `leave_document socket:${client.id} document:${documentId} activeUsers:${activeUsers.length}`,
    );
    ack?.(response);
    return response;
  }

  @SubscribeMessage('document_message_typing')
  async handleDocumentMessageTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DocumentMessageTypingPayload,
  ) {
    try {
      const user = await this.resolveSocketUser(client);
      const documentId = payload?.documentId?.trim();
      if (!documentId) {
        throw new WsException('documentId is required.');
      }

      if (!(await this.assertDocumentReadAccess(user.id, documentId))) {
        throw new WsException('You do not have access to this document.');
      }

      const event = {
        documentId,
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
        },
        isTyping: payload?.isTyping === true,
      };

      client.to(this.roomName(documentId)).emit('document_message_typing', event);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof WsException
          ? (error.getError() as string)
          : error instanceof Error
            ? error.message
            : 'Failed to publish typing state.';
      this.logger.warn(
        `document_message_typing failure socket:${client.id} error:${message}`,
      );
      throw error;
    }
  }

  @SubscribeMessage('cursor_update')
  async handleCursorUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CursorUpdatePayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    try {
      const user = await this.resolveSocketUser(client);
      const documentId = payload?.documentId?.trim();
      if (!documentId) {
        throw new WsException('documentId is required.');
      }

      if (!(await this.assertDocumentReadAccess(user.id, documentId))) {
        throw new WsException('You do not have access to this document.');
      }

      if (
        !Number.isFinite(payload.anchorOffset) ||
        !Number.isFinite(payload.focusOffset)
      ) {
        throw new WsException('anchorOffset and focusOffset must be numbers.');
      }

      const color =
        typeof payload.color === 'string' && payload.color.trim().length > 0
          ? payload.color.trim()
          : '#7c3aed';

      this.realtimeService.updateDocumentCursor({
        documentId,
        user: { userId: user.id, fullName: user.fullName },
        color,
        anchorOffset: Math.max(0, Math.floor(payload.anchorOffset)),
        focusOffset: Math.max(0, Math.floor(payload.focusOffset)),
        updatedAt: new Date().toISOString(),
      });

      const response = { ok: true };
      ack?.(response);
      return response;
    } catch (error) {
      const message =
        error instanceof WsException
          ? (error.getError() as string)
          : error instanceof Error
            ? error.message
            : 'Failed to update cursor.';
      this.logger.warn(`cursor_update failure socket:${client.id} error:${message}`);
      ack?.({ ok: false, error: message });
      throw error;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.startsWith('Bearer ')
        ? authToken.slice('Bearer '.length)
        : authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return null;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new WsException('Invalid or expired token.');
    }
  }

  private async resolveSocketUser(
    client: AuthenticatedSocket,
  ): Promise<AuthenticatedUser> {
    if (client.data.user) {
      return client.data.user;
    }

    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Authentication required.');
    }

    const payload = await this.verifyToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new WsException('Authentication required.');
    }

    if (!payload.sessionId) {
      throw new WsException('Authentication required.');
    }

    await this.userSessionService.assertSessionActive(
      payload.sessionId,
      user.id,
    );

    const resolvedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      sessionId: payload.sessionId,
    };

    client.data.user = resolvedUser;
    return resolvedUser;
  }

  private async assertDocumentReadAccess(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        OR: [
          {
            workspace: {
              members: {
                some: {
                  userId,
                  role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
                },
              },
            },
          },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });

    return Boolean(document);
  }

  private roomName(documentId: string): string {
    return `document:${documentId}`;
  }
}
