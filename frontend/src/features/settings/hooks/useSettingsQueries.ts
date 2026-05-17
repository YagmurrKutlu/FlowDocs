import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '../api/settings.api';
import type { PartialUserSettings, UserSettings } from '../types/settings.types';

export const settingsQueryKeys = {
  me: () => ['settings', 'me'] as const,
};

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.me(),
    queryFn: fetchSettings,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partial: PartialUserSettings) => updateSettings(partial),
    onMutate: async (partial) => {
      await queryClient.cancelQueries({ queryKey: settingsQueryKeys.me() });
      const previous = queryClient.getQueryData<UserSettings>(
        settingsQueryKeys.me(),
      );

      if (previous) {
        const optimistic: UserSettings = {
          ...previous,
          ...(partial.editorPreferences && {
            editorPreferences: {
              ...previous.editorPreferences,
              ...partial.editorPreferences,
            },
          }),
          ...(partial.collaborationPreferences && {
            collaborationPreferences: {
              ...previous.collaborationPreferences,
              ...partial.collaborationPreferences,
            },
          }),
          ...(partial.notificationPreferences && {
            notificationPreferences: {
              ...previous.notificationPreferences,
              ...partial.notificationPreferences,
            },
          }),
          ...(partial.privacyPreferences && {
            privacyPreferences: {
              ...previous.privacyPreferences,
              ...partial.privacyPreferences,
            },
          }),
          ...(partial.dataStoragePreferences && {
            dataStoragePreferences: {
              ...previous.dataStoragePreferences,
              ...partial.dataStoragePreferences,
            },
          }),
          ...(partial.accessibilityPreferences && {
            accessibilityPreferences: {
              ...previous.accessibilityPreferences,
              ...partial.accessibilityPreferences,
            },
          }),
          ...(partial.experimentalPreferences && {
            experimentalPreferences: {
              ...previous.experimentalPreferences,
              ...partial.experimentalPreferences,
            },
          }),
        };
        queryClient.setQueryData(settingsQueryKeys.me(), optimistic);
      }

      return { previous };
    },
    onError: (_error, _partial, context) => {
      if (context?.previous) {
        queryClient.setQueryData(settingsQueryKeys.me(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsQueryKeys.me() });
    },
  });
}
