import { apiClient } from '../../../shared/api/client';
import type {
  MyProfileResponse,
  ProfileAppearance,
  ProfileNotifications,
  UpdateProfilePayload,
} from '../types/profile.types';

export async function fetchMyProfile(): Promise<MyProfileResponse> {
  const { data } = await apiClient.get<MyProfileResponse>('/profile/me');
  return data;
}

export async function updateMyProfile(
  payload: UpdateProfilePayload,
): Promise<MyProfileResponse> {
  const { data } = await apiClient.patch<MyProfileResponse>('/profile/me', payload);
  return data;
}

export async function updateProfileNotifications(
  payload: Partial<ProfileNotifications>,
): Promise<{ notifications: ProfileNotifications }> {
  const { data } = await apiClient.patch<{ notifications: ProfileNotifications }>(
    '/profile/notifications',
    payload,
  );
  return data;
}

export async function updateProfileAppearance(
  payload: Partial<ProfileAppearance>,
): Promise<{ appearance: ProfileAppearance }> {
  const { data } = await apiClient.patch<{ appearance: ProfileAppearance }>(
    '/profile/appearance',
    payload,
  );
  return data;
}

export async function revokeProfileSession(
  sessionId: string,
): Promise<MyProfileResponse> {
  const { data } = await apiClient.delete<MyProfileResponse>(
    `/profile/sessions/${sessionId}`,
  );
  return data;
}

export async function revokeAllOtherProfileSessions(): Promise<MyProfileResponse> {
  const { data } = await apiClient.post<MyProfileResponse>(
    '/profile/sessions/revoke-all',
  );
  return data;
}
