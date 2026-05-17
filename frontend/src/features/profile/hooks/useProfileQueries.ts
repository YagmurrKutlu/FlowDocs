import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  fetchMyProfile,
  revokeAllOtherProfileSessions,
  revokeProfileSession,
  updateMyProfile,
  updateProfileAppearance,
  updateProfileNotifications,
} from '../api/profile.api';
import type {
  MyProfileResponse,
  ProfileAppearance,
  ProfileNotifications,
  UpdateProfilePayload,
} from '../types/profile.types';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';

export const profileQueryKeys = {
  all: ['profile'] as const,
  me: () => [...profileQueryKeys.all, 'me'] as const,
};

export function useMyProfileQuery() {
  return useQuery({
    queryKey: profileQueryKeys.me(),
    queryFn: fetchMyProfile,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateMyProfile(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKeys.me(), data);
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.displayName || data.user.name,
        avatarUrl: data.user.avatarUrl,
      });
      notifications.show({
        color: 'teal',
        title: 'Profil güncellendi',
        message: 'Değişiklikler kaydedildi.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Profil güncellenemedi',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useUpdateProfileNotificationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<ProfileNotifications>) =>
      updateProfileNotifications(payload),
    onSuccess: (data) => {
      queryClient.setQueryData<MyProfileResponse | undefined>(
        profileQueryKeys.me(),
        (prev) => (prev ? { ...prev, notifications: data.notifications } : prev),
      );
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Bildirim ayarı kaydedilemedi',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useRevokeProfileSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => revokeProfileSession(sessionId),
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKeys.me(), data);
      notifications.show({
        color: 'teal',
        title: 'Oturum sonlandırıldı',
        message: 'Seçilen oturum listeden kaldırıldı.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Oturum sonlandırılamadı',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useRevokeAllProfileSessionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => revokeAllOtherProfileSessions(),
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKeys.me(), data);
      notifications.show({
        color: 'teal',
        title: 'Diğer oturumlar kapatıldı',
        message: 'Mevcut oturumunuz dışındaki oturumlar sonlandırıldı.',
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Oturumlar kapatılamadı',
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useUpdateProfileAppearanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<ProfileAppearance>) =>
      updateProfileAppearance(payload),
    onSuccess: (data) => {
      queryClient.setQueryData<MyProfileResponse | undefined>(
        profileQueryKeys.me(),
        (prev) => (prev ? { ...prev, appearance: data.appearance } : prev),
      );
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Görünüm ayarı kaydedilemedi',
        message: getApiErrorMessage(error),
      });
    },
  });
}
