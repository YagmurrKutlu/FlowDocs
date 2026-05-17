export type AutosaveInterval = 'instant' | '5s' | '15s';
export type FontSize = 'small' | 'medium' | 'large';
export type LineHeight = 'compact' | 'comfortable' | 'spacious';
export type DefaultExportFormat = 'pdf' | 'docx' | 'html' | 'markdown';

export interface EditorPreferences {
  autosaveInterval: AutosaveInterval;
  showCollaboratorCursors: boolean;
  showCommentHighlights: boolean;
  spellcheck: boolean;
  compactToolbar: boolean;
  markdownShortcuts: boolean;
  autoLinkDetection: boolean;
  autoToc: boolean;
  fontSize: FontSize;
  lineHeight: LineHeight;
}

export interface CollaborationPreferences {
  showPresence: boolean;
  showTypingIndicator: boolean;
  showJoinNotifications: boolean;
  realtimeAnimations: boolean;
  showOnlineStatus: boolean;
}

export interface NotificationPreferences {
  comments: boolean;
  mentions: boolean;
  shares: boolean;
  workspaceInvites: boolean;
  emailDigest: boolean;
  browserNotifications: boolean;
  soundNotifications: boolean;
}

export interface PrivacyPreferences {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowMentions: boolean;
  showProfileToWorkspace: boolean;
}

export interface DataStoragePreferences {
  defaultExportFormat: DefaultExportFormat;
  autoBackup: boolean;
  imageCompression: boolean;
  keepOriginalUploads: boolean;
}

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  largerText: boolean;
  visibleFocus: boolean;
}

export interface ExperimentalPreferences {
  smartSuggestions: boolean;
  advancedSyncDiagnostics: boolean;
  floatingToolbarBeta: boolean;
}

export interface UserSettings {
  editorPreferences: EditorPreferences;
  collaborationPreferences: CollaborationPreferences;
  notificationPreferences: NotificationPreferences;
  privacyPreferences: PrivacyPreferences;
  dataStoragePreferences: DataStoragePreferences;
  accessibilityPreferences: AccessibilityPreferences;
  experimentalPreferences: ExperimentalPreferences;
}

export type SettingsCategory = keyof UserSettings;

export type PartialUserSettings = {
  [K in SettingsCategory]?: Partial<UserSettings[K]>;
};

export type SettingsSectionId =
  | 'editor'
  | 'collaboration'
  | 'notifications'
  | 'privacy'
  | 'data'
  | 'accessibility'
  | 'shortcuts'
  | 'experimental'
  | 'danger';
