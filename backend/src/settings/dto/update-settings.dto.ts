import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class UpdateEditorPreferencesDto {
  @IsOptional()
  @IsIn(['instant', '5s', '15s'])
  autosaveInterval?: 'instant' | '5s' | '15s';

  @IsOptional()
  @IsBoolean()
  showCollaboratorCursors?: boolean;

  @IsOptional()
  @IsBoolean()
  showCommentHighlights?: boolean;

  @IsOptional()
  @IsBoolean()
  spellcheck?: boolean;

  @IsOptional()
  @IsBoolean()
  compactToolbar?: boolean;

  @IsOptional()
  @IsBoolean()
  markdownShortcuts?: boolean;

  @IsOptional()
  @IsBoolean()
  autoLinkDetection?: boolean;

  @IsOptional()
  @IsBoolean()
  autoToc?: boolean;

  @IsOptional()
  @IsIn(['small', 'medium', 'large'])
  fontSize?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsIn(['compact', 'comfortable', 'spacious'])
  lineHeight?: 'compact' | 'comfortable' | 'spacious';
}

export class UpdateCollaborationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  showPresence?: boolean;

  @IsOptional()
  @IsBoolean()
  showTypingIndicator?: boolean;

  @IsOptional()
  @IsBoolean()
  showJoinNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  realtimeAnimations?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  comments?: boolean;

  @IsOptional()
  @IsBoolean()
  mentions?: boolean;

  @IsOptional()
  @IsBoolean()
  shares?: boolean;

  @IsOptional()
  @IsBoolean()
  workspaceInvites?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  browserNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  soundNotifications?: boolean;
}

export class UpdatePrivacyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  showProfileToWorkspace?: boolean;
}

export class UpdateDataStoragePreferencesDto {
  @IsOptional()
  @IsIn(['pdf', 'docx', 'html', 'markdown'])
  defaultExportFormat?: 'pdf' | 'docx' | 'html' | 'markdown';

  @IsOptional()
  @IsBoolean()
  autoBackup?: boolean;

  @IsOptional()
  @IsBoolean()
  imageCompression?: boolean;

  @IsOptional()
  @IsBoolean()
  keepOriginalUploads?: boolean;
}

export class UpdateAccessibilityPreferencesDto {
  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  largerText?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleFocus?: boolean;
}

export class UpdateExperimentalPreferencesDto {
  @IsOptional()
  @IsBoolean()
  smartSuggestions?: boolean;

  @IsOptional()
  @IsBoolean()
  advancedSyncDiagnostics?: boolean;

  @IsOptional()
  @IsBoolean()
  floatingToolbarBeta?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEditorPreferencesDto)
  editorPreferences?: UpdateEditorPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCollaborationPreferencesDto)
  collaborationPreferences?: UpdateCollaborationPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationPreferencesDto)
  notificationPreferences?: UpdateNotificationPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePrivacyPreferencesDto)
  privacyPreferences?: UpdatePrivacyPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDataStoragePreferencesDto)
  dataStoragePreferences?: UpdateDataStoragePreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAccessibilityPreferencesDto)
  accessibilityPreferences?: UpdateAccessibilityPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExperimentalPreferencesDto)
  experimentalPreferences?: UpdateExperimentalPreferencesDto;
}
