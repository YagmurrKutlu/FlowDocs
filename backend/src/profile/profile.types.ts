export interface ProfileNotificationSettings {
  editNotifications: boolean;
  commentNotifications: boolean;
  userJoinedNotifications: boolean;
  emailSummary: boolean;
}

export interface ProfileAppearanceSettings {
  language: 'tr' | 'en';
  fontFamily: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: ProfileNotificationSettings = {
  editNotifications: true,
  commentNotifications: true,
  userJoinedNotifications: false,
  emailSummary: false,
};

export const DEFAULT_APPEARANCE_SETTINGS: ProfileAppearanceSettings = {
  language: 'tr',
  fontFamily: 'Geist (Varsayılan)',
};
