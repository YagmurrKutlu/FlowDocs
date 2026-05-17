import { useSettingsQuery } from './useSettingsQueries';

export function useAccessibilityPreferences() {
  const { data } = useSettingsQuery();
  return data?.accessibilityPreferences;
}

export function useExperimentalPreference(
  key:
    | 'smartSuggestions'
    | 'advancedSyncDiagnostics'
    | 'floatingToolbarBeta',
): boolean {
  const { data } = useSettingsQuery();
  return data?.experimentalPreferences[key] ?? false;
}

export function useBrowserNotificationsEnabled(): boolean {
  const { data } = useSettingsQuery();
  return data?.notificationPreferences.browserNotifications ?? false;
}
