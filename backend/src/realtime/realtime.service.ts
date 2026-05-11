import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export interface RealtimePresenceUser {
  userId: string;
  fullName: string;
}

export interface DocumentUpdateRealtimeEvent {
  documentId: string;
  updateBase64: string;
  sourceClientId?: string;
}

export interface DocumentMemberUpdatedRealtimeEvent {
  documentId: string;
}

export interface DocumentCursorState {
  documentId: string;
  userId: string;
  fullName: string;
  color: string;
  anchorOffset: number;
  focusOffset: number;
  updatedAt: string;
}

@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private readonly documentPresence = new Map<
    string,
    Map<string, RealtimePresenceUser>
  >();
  private readonly documentCursors = new Map<
    string,
    Map<string, DocumentCursorState>
  >();

  attachServer(server: Server): void {
    this.server = server;
  }

  joinDocumentRoom(params: {
    documentId: string;
    socketId: string;
    user: RealtimePresenceUser;
  }): RealtimePresenceUser[] {
    const roomState = this.getOrCreateRoomState(params.documentId);
    roomState.set(params.socketId, params.user);
    return this.broadcastPresence(params.documentId);
  }

  leaveDocumentRoom(documentId: string, socketId: string): RealtimePresenceUser[] {
    const roomState = this.documentPresence.get(documentId);
    if (!roomState) return [];

    const leavingUserId = roomState.get(socketId)?.userId;
    roomState.delete(socketId);
    if (
      leavingUserId &&
      !this.isUserStillPresentInDocument(documentId, leavingUserId)
    ) {
      this.removeCursorForUser(documentId, leavingUserId);
    }

    if (roomState.size === 0) {
      this.documentPresence.delete(documentId);
      this.documentCursors.delete(documentId);
      this.broadcastCursors(documentId);
      return [];
    }

    return this.broadcastPresence(documentId);
  }

  removeSocketFromAllRooms(socketId: string): void {
    for (const [documentId, roomState] of this.documentPresence) {
      const leavingUserId = roomState.get(socketId)?.userId;
      if (!roomState.delete(socketId)) continue;

      if (
        leavingUserId &&
        !this.isUserStillPresentInDocument(documentId, leavingUserId)
      ) {
        this.removeCursorForUser(documentId, leavingUserId);
      }

      if (roomState.size === 0) {
        this.documentPresence.delete(documentId);
        this.documentCursors.delete(documentId);
        this.broadcastCursors(documentId);
      } else {
        this.broadcastPresence(documentId);
      }
    }
  }

  getDocumentActiveUsers(documentId: string): RealtimePresenceUser[] {
    return this.collectUniqueUsers(documentId);
  }

  publishDocumentUpdate(event: DocumentUpdateRealtimeEvent): void {
    if (!this.server) return;
    this.server.to(this.roomName(event.documentId)).emit('document_update', event);
  }

  publishDocumentMemberUpdated(event: DocumentMemberUpdatedRealtimeEvent): void {
    if (!this.server) return;
    this.server
      .to(this.roomName(event.documentId))
      .emit('document_member_updated', event);
  }

  updateDocumentCursor(params: {
    documentId: string;
    user: RealtimePresenceUser;
    color: string;
    anchorOffset: number;
    focusOffset: number;
    updatedAt: string;
  }): DocumentCursorState[] {
    const cursorState: DocumentCursorState = {
      documentId: params.documentId,
      userId: params.user.userId,
      fullName: params.user.fullName,
      color: params.color,
      anchorOffset: params.anchorOffset,
      focusOffset: params.focusOffset,
      updatedAt: params.updatedAt,
    };

    const roomCursors = this.getOrCreateCursorRoomState(params.documentId);
    roomCursors.set(params.user.userId, cursorState);
    return this.broadcastCursors(params.documentId);
  }

  getStatus() {
    return {
      namespace: '/realtime',
      transport: 'socket.io',
      status: 'ready',
    };
  }

  private getOrCreateRoomState(documentId: string) {
    const existing = this.documentPresence.get(documentId);
    if (existing) return existing;

    const created = new Map<string, RealtimePresenceUser>();
    this.documentPresence.set(documentId, created);
    return created;
  }

  private getOrCreateCursorRoomState(documentId: string) {
    const existing = this.documentCursors.get(documentId);
    if (existing) return existing;

    const created = new Map<string, DocumentCursorState>();
    this.documentCursors.set(documentId, created);
    return created;
  }

  private broadcastPresence(documentId: string): RealtimePresenceUser[] {
    const activeUsers = this.collectUniqueUsers(documentId);
    this.server
      ?.to(this.roomName(documentId))
      .emit('document_presence', { documentId, activeUsers });
    return activeUsers;
  }

  private collectUniqueUsers(documentId: string): RealtimePresenceUser[] {
    const roomState = this.documentPresence.get(documentId);
    if (!roomState) return [];

    const uniqueUsers = new Map<string, RealtimePresenceUser>();
    for (const user of roomState.values()) {
      uniqueUsers.set(user.userId, user);
    }
    return [...uniqueUsers.values()];
  }

  private broadcastCursors(documentId: string): DocumentCursorState[] {
    const cursors = this.collectDocumentCursors(documentId);
    this.server
      ?.to(this.roomName(documentId))
      .emit('document_cursor', { documentId, cursors });
    return cursors;
  }

  private collectDocumentCursors(documentId: string): DocumentCursorState[] {
    const roomCursors = this.documentCursors.get(documentId);
    if (!roomCursors) return [];
    return [...roomCursors.values()];
  }

  private isUserStillPresentInDocument(
    documentId: string,
    userId: string,
  ): boolean {
    const roomState = this.documentPresence.get(documentId);
    if (!roomState) return false;
    for (const user of roomState.values()) {
      if (user.userId === userId) {
        return true;
      }
    }
    return false;
  }

  private removeCursorForUser(documentId: string, userId: string): void {
    const roomCursors = this.documentCursors.get(documentId);
    if (!roomCursors) return;
    roomCursors.delete(userId);
    if (roomCursors.size === 0) {
      this.documentCursors.delete(documentId);
    }
    this.broadcastCursors(documentId);
  }

  private roomName(documentId: string): string {
    return `document:${documentId}`;
  }
}
