import { Prisma } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from './settings.types';

/** Extended notification JSON stored on UserProfile.notificationSettings */
export interface StoredNotificationSettings {
  editNotifications?: boolean;
  commentNotifications?: boolean;
  userJoinedNotifications?: boolean;
  emailSummary?: boolean;
  mentions?: boolean;
  browserNotifications?: boolean;
  soundNotifications?: boolean;
}

export function notificationPreferencesFromStored(
  value: Prisma.JsonValue | null,
): NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const record = value as StoredNotificationSettings;

  return {
    comments:
      typeof record.commentNotifications === 'boolean'
        ? record.commentNotifications
        : DEFAULT_NOTIFICATION_PREFERENCES.comments,
    mentions:
      typeof record.mentions === 'boolean'
        ? record.mentions
        : DEFAULT_NOTIFICATION_PREFERENCES.mentions,
    shares:
      typeof record.editNotifications === 'boolean'
        ? record.editNotifications
        : DEFAULT_NOTIFICATION_PREFERENCES.shares,
    workspaceInvites:
      typeof record.userJoinedNotifications === 'boolean'
        ? record.userJoinedNotifications
        : DEFAULT_NOTIFICATION_PREFERENCES.workspaceInvites,
    emailDigest:
      typeof record.emailSummary === 'boolean'
        ? record.emailSummary
        : DEFAULT_NOTIFICATION_PREFERENCES.emailDigest,
    browserNotifications:
      typeof record.browserNotifications === 'boolean'
        ? record.browserNotifications
        : DEFAULT_NOTIFICATION_PREFERENCES.browserNotifications,
    soundNotifications:
      typeof record.soundNotifications === 'boolean'
        ? record.soundNotifications
        : DEFAULT_NOTIFICATION_PREFERENCES.soundNotifications,
  };
}

export function mergeNotificationPreferencesIntoStored(
  current: Prisma.JsonValue | null,
  patch: Partial<NotificationPreferences>,
): StoredNotificationSettings {
  const existing = notificationPreferencesFromStored(current);
  const next: NotificationPreferences = { ...existing, ...patch };

  return {
    commentNotifications: next.comments,
    editNotifications: next.shares,
    userJoinedNotifications: next.workspaceInvites,
    emailSummary: next.emailDigest,
    mentions: next.mentions,
    browserNotifications: next.browserNotifications,
    soundNotifications: next.soundNotifications,
  };
}
