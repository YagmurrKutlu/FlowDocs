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

export interface UserSettingsResponse {
  editorPreferences: EditorPreferences;
  collaborationPreferences: CollaborationPreferences;
  notificationPreferences: NotificationPreferences;
  privacyPreferences: PrivacyPreferences;
  dataStoragePreferences: DataStoragePreferences;
  accessibilityPreferences: AccessibilityPreferences;
  experimentalPreferences: ExperimentalPreferences;
}

export interface StoredUserSettings {
  editorPreferences?: Partial<EditorPreferences>;
  collaborationPreferences?: Partial<CollaborationPreferences>;
  privacyPreferences?: Partial<PrivacyPreferences>;
  dataStoragePreferences?: Partial<DataStoragePreferences>;
  accessibilityPreferences?: Partial<AccessibilityPreferences>;
  experimentalPreferences?: Partial<ExperimentalPreferences>;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  autosaveInterval: 'instant',
  showCollaboratorCursors: true,
  showCommentHighlights: true,
  spellcheck: true,
  compactToolbar: false,
  markdownShortcuts: true,
  autoLinkDetection: true,
  autoToc: true,
  fontSize: 'medium',
  lineHeight: 'comfortable',
};

export const DEFAULT_COLLABORATION_PREFERENCES: CollaborationPreferences = {
  showPresence: true,
  showTypingIndicator: true,
  showJoinNotifications: true,
  realtimeAnimations: true,
  showOnlineStatus: true,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  comments: true,
  mentions: true,
  shares: true,
  workspaceInvites: true,
  emailDigest: false,
  browserNotifications: false,
  soundNotifications: false,
};

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  showOnlineStatus: true,
  showLastSeen: false,
  allowMentions: true,
  showProfileToWorkspace: true,
};

export const DEFAULT_DATA_STORAGE_PREFERENCES: DataStoragePreferences = {
  defaultExportFormat: 'pdf',
  autoBackup: true,
  imageCompression: true,
  keepOriginalUploads: true,
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  largerText: false,
  visibleFocus: true,
};

export const DEFAULT_EXPERIMENTAL_PREFERENCES: ExperimentalPreferences = {
  smartSuggestions: false,
  advancedSyncDiagnostics: false,
  floatingToolbarBeta: false,
};

export const DEFAULT_USER_SETTINGS: UserSettingsResponse = {
  editorPreferences: DEFAULT_EDITOR_PREFERENCES,
  collaborationPreferences: DEFAULT_COLLABORATION_PREFERENCES,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  privacyPreferences: DEFAULT_PRIVACY_PREFERENCES,
  dataStoragePreferences: DEFAULT_DATA_STORAGE_PREFERENCES,
  accessibilityPreferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
  experimentalPreferences: DEFAULT_EXPERIMENTAL_PREFERENCES,
};
