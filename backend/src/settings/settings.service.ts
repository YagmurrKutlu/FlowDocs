import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type UserProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../profile/profile.types';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  deepMergeStoredSettings,
  DEFAULT_STORED_SETTINGS,
  isSettingsPersistenceError,
  mergeCategoryPatch,
  normalizeRawSettings,
} from './settings-merge.util';
import {
  mergeNotificationPreferencesIntoStored,
  notificationPreferencesFromStored,
} from './settings-notification.mapper';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  DEFAULT_COLLABORATION_PREFERENCES,
  DEFAULT_DATA_STORAGE_PREFERENCES,
  DEFAULT_EDITOR_PREFERENCES,
  DEFAULT_EXPERIMENTAL_PREFERENCES,
  DEFAULT_PRIVACY_PREFERENCES,
  DEFAULT_USER_SETTINGS,
  type AccessibilityPreferences,
  type AutosaveInterval,
  type CollaborationPreferences,
  type DataStoragePreferences,
  type DefaultExportFormat,
  type EditorPreferences,
  type ExperimentalPreferences,
  type FontSize,
  type LineHeight,
  type PrivacyPreferences,
  type StoredUserSettings,
  type UserSettingsResponse,
} from './settings.types';

const AUTOSAVE_INTERVALS = new Set<AutosaveInterval>(['instant', '5s', '15s']);
const FONT_SIZES = new Set<FontSize>(['small', 'medium', 'large']);
const LINE_HEIGHTS = new Set<LineHeight>(['compact', 'comfortable', 'spacious']);
const EXPORT_FORMATS = new Set<DefaultExportFormat>([
  'pdf',
  'docx',
  'html',
  'markdown',
]);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMySettings(userId: string): Promise<UserSettingsResponse> {
    try {
      const profile = await this.ensureProfile(userId);
      return this.buildSettingsResponse(profile);
    } catch (error) {
      this.logSettingsFailure('load', error);
      return this.cloneDefaultSettings();
    }
  }

  async updateMySettings(
    userId: string,
    payload: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    try {
      const profile = await this.ensureProfile(userId);
      const rawSettings = normalizeRawSettings(profile.settings);
      const stored = deepMergeStoredSettings(DEFAULT_STORED_SETTINGS, rawSettings);
      const updateData: Prisma.UserProfileUpdateInput = {};

      if (payload.editorPreferences) {
        stored.editorPreferences = mergeCategoryPatch(
          stored.editorPreferences,
          payload.editorPreferences,
        );
      }
      if (payload.collaborationPreferences) {
        stored.collaborationPreferences = mergeCategoryPatch(
          stored.collaborationPreferences,
          payload.collaborationPreferences,
        );
      }
      if (payload.privacyPreferences) {
        stored.privacyPreferences = mergeCategoryPatch(
          stored.privacyPreferences,
          payload.privacyPreferences,
        );
      }
      if (payload.dataStoragePreferences) {
        stored.dataStoragePreferences = mergeCategoryPatch(
          stored.dataStoragePreferences,
          payload.dataStoragePreferences,
        );
      }
      if (payload.accessibilityPreferences) {
        stored.accessibilityPreferences = mergeCategoryPatch(
          stored.accessibilityPreferences,
          payload.accessibilityPreferences,
        );
      }
      if (payload.experimentalPreferences) {
        stored.experimentalPreferences = mergeCategoryPatch(
          stored.experimentalPreferences,
          payload.experimentalPreferences,
        );
      }

      const hasJsonUpdate =
        payload.editorPreferences ||
        payload.collaborationPreferences ||
        payload.privacyPreferences ||
        payload.dataStoragePreferences ||
        payload.accessibilityPreferences ||
        payload.experimentalPreferences;

      if (hasJsonUpdate) {
        updateData.settings = stored as unknown as Prisma.InputJsonValue;
      }

      if (payload.notificationPreferences) {
        updateData.notificationSettings =
          mergeNotificationPreferencesIntoStored(
            profile.notificationSettings ?? null,
            payload.notificationPreferences,
          ) as unknown as Prisma.InputJsonValue;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.userProfile.update({
          where: { userId },
          data: updateData,
        });
      }

      return this.getMySettings(userId);
    } catch (error) {
      this.logSettingsFailure('update', error);

      try {
        return await this.getMySettings(userId);
      } catch {
        return this.cloneDefaultSettings();
      }
    }
  }

  private buildSettingsResponse(profile: UserProfile): UserSettingsResponse {
    const rawSettings = normalizeRawSettings(profile.settings);
    const merged = deepMergeStoredSettings(DEFAULT_STORED_SETTINGS, rawSettings);

    return {
      editorPreferences: this.parseEditorPreferences(merged.editorPreferences),
      collaborationPreferences: this.parseCollaborationPreferences(
        merged.collaborationPreferences,
      ),
      notificationPreferences: notificationPreferencesFromStored(
        profile.notificationSettings ?? null,
      ),
      privacyPreferences: this.parsePrivacyPreferences(merged.privacyPreferences),
      dataStoragePreferences: this.parseDataStoragePreferences(
        merged.dataStoragePreferences,
      ),
      accessibilityPreferences: this.parseAccessibilityPreferences(
        merged.accessibilityPreferences,
      ),
      experimentalPreferences: this.parseExperimentalPreferences(
        merged.experimentalPreferences,
      ),
    };
  }

  private parseEditorPreferences(
    partial?: Partial<EditorPreferences>,
  ): EditorPreferences {
    const base = DEFAULT_EDITOR_PREFERENCES;
    const safe = partial && typeof partial === 'object' ? partial : {};
    const interval = safe.autosaveInterval;
    const fontSize = safe.fontSize;
    const lineHeight = safe.lineHeight;

    return {
      autosaveInterval:
        interval && AUTOSAVE_INTERVALS.has(interval)
          ? interval
          : base.autosaveInterval,
      showCollaboratorCursors:
        typeof safe.showCollaboratorCursors === 'boolean'
          ? safe.showCollaboratorCursors
          : base.showCollaboratorCursors,
      showCommentHighlights:
        typeof safe.showCommentHighlights === 'boolean'
          ? safe.showCommentHighlights
          : base.showCommentHighlights,
      spellcheck:
        typeof safe.spellcheck === 'boolean' ? safe.spellcheck : base.spellcheck,
      compactToolbar:
        typeof safe.compactToolbar === 'boolean'
          ? safe.compactToolbar
          : base.compactToolbar,
      markdownShortcuts:
        typeof safe.markdownShortcuts === 'boolean'
          ? safe.markdownShortcuts
          : base.markdownShortcuts,
      autoLinkDetection:
        typeof safe.autoLinkDetection === 'boolean'
          ? safe.autoLinkDetection
          : base.autoLinkDetection,
      autoToc: typeof safe.autoToc === 'boolean' ? safe.autoToc : base.autoToc,
      fontSize:
        fontSize && FONT_SIZES.has(fontSize) ? fontSize : base.fontSize,
      lineHeight:
        lineHeight && LINE_HEIGHTS.has(lineHeight)
          ? lineHeight
          : base.lineHeight,
    };
  }

  private parseCollaborationPreferences(
    partial?: Partial<CollaborationPreferences>,
  ): CollaborationPreferences {
    return { ...DEFAULT_COLLABORATION_PREFERENCES, ...partial };
  }

  private parsePrivacyPreferences(
    partial?: Partial<PrivacyPreferences>,
  ): PrivacyPreferences {
    return { ...DEFAULT_PRIVACY_PREFERENCES, ...partial };
  }

  private parseDataStoragePreferences(
    partial?: Partial<DataStoragePreferences>,
  ): DataStoragePreferences {
    const base = DEFAULT_DATA_STORAGE_PREFERENCES;
    const safe = partial && typeof partial === 'object' ? partial : {};
    const format = safe.defaultExportFormat;

    return {
      defaultExportFormat:
        format && EXPORT_FORMATS.has(format)
          ? format
          : base.defaultExportFormat,
      autoBackup:
        typeof safe.autoBackup === 'boolean' ? safe.autoBackup : base.autoBackup,
      imageCompression:
        typeof safe.imageCompression === 'boolean'
          ? safe.imageCompression
          : base.imageCompression,
      keepOriginalUploads:
        typeof safe.keepOriginalUploads === 'boolean'
          ? safe.keepOriginalUploads
          : base.keepOriginalUploads,
    };
  }

  private parseAccessibilityPreferences(
    partial?: Partial<AccessibilityPreferences>,
  ): AccessibilityPreferences {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...partial };
  }

  private parseExperimentalPreferences(
    partial?: Partial<ExperimentalPreferences>,
  ): ExperimentalPreferences {
    return { ...DEFAULT_EXPERIMENTAL_PREFERENCES, ...partial };
  }

  private async ensureProfile(userId: string): Promise<UserProfile> {
    try {
      const found = await this.prisma.userProfile.findUnique({
        where: { userId },
      });
      if (found) {
        return found;
      }

      return await this.prisma.userProfile.create({
        data: {
          userId,
          notificationSettings:
            DEFAULT_NOTIFICATION_SETTINGS as unknown as Prisma.InputJsonValue,
          appearanceSettings:
            DEFAULT_APPEARANCE_SETTINGS as unknown as Prisma.InputJsonValue,
          settings: {} as unknown as Prisma.InputJsonValue,
          skills: [],
        },
      });
    } catch (error) {
      if (!isSettingsPersistenceError(error)) {
        throw error;
      }

      this.logger.warn(
        '[settings] settings column unavailable; using profile without persisted JSON',
      );

      const found = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          bio: true,
          location: true,
          title: true,
          coverUrl: true,
          skills: true,
          notificationSettings: true,
          appearanceSettings: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (found) {
        return { ...found, settings: null };
      }

      const created = await this.prisma.userProfile.create({
        data: {
          userId,
          notificationSettings:
            DEFAULT_NOTIFICATION_SETTINGS as unknown as Prisma.InputJsonValue,
          appearanceSettings:
            DEFAULT_APPEARANCE_SETTINGS as unknown as Prisma.InputJsonValue,
          skills: [],
        },
        select: {
          id: true,
          userId: true,
          displayName: true,
          bio: true,
          location: true,
          title: true,
          coverUrl: true,
          skills: true,
          notificationSettings: true,
          appearanceSettings: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { ...created, settings: null };
    }
  }

  private cloneDefaultSettings(): UserSettingsResponse {
    return JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS)) as UserSettingsResponse;
  }

  private logSettingsFailure(action: 'load' | 'update', error: unknown): void {
    const detail =
      error instanceof Error ? error.message : String(error ?? 'unknown');
    this.logger.error(`[settings] failed to ${action} settings: ${detail}`);
  }
}

export { DEFAULT_USER_SETTINGS };
