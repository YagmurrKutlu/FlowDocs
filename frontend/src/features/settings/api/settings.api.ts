import { apiClient } from '../../../shared/api/client';
import type { PartialUserSettings, UserSettings } from '../types/settings.types';

export async function fetchSettings(): Promise<UserSettings> {
  const { data } = await apiClient.get<UserSettings>('/settings/me');
  return data;
}

export async function updateSettings(
  partial: PartialUserSettings,
): Promise<UserSettings> {
  const { data } = await apiClient.patch<UserSettings>('/settings/me', partial);
  return data;
}
