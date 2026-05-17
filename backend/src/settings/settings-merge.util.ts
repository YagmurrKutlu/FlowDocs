import type { Prisma } from '@prisma/client';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  DEFAULT_COLLABORATION_PREFERENCES,
  DEFAULT_DATA_STORAGE_PREFERENCES,
  DEFAULT_EDITOR_PREFERENCES,
  DEFAULT_EXPERIMENTAL_PREFERENCES,
  DEFAULT_PRIVACY_PREFERENCES,
  type StoredUserSettings,
} from './settings.types';

export const DEFAULT_STORED_SETTINGS: StoredUserSettings = {
  editorPreferences: { ...DEFAULT_EDITOR_PREFERENCES },
  collaborationPreferences: { ...DEFAULT_COLLABORATION_PREFERENCES },
  privacyPreferences: { ...DEFAULT_PRIVACY_PREFERENCES },
  dataStoragePreferences: { ...DEFAULT_DATA_STORAGE_PREFERENCES },
  accessibilityPreferences: { ...DEFAULT_ACCESSIBILITY_PREFERENCES },
  experimentalPreferences: { ...DEFAULT_EXPERIMENTAL_PREFERENCES },
};

/** Full API response defaults (alias for service fallbacks). */
export { DEFAULT_USER_SETTINGS as DEFAULT_SETTINGS } from './settings.types';

const CATEGORY_KEYS = [
  'editorPreferences',
  'collaborationPreferences',
  'privacyPreferences',
  'dataStoragePreferences',
  'accessibilityPreferences',
  'experimentalPreferences',
] as const satisfies readonly (keyof StoredUserSettings)[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategoryKey(key: string): key is keyof StoredUserSettings {
  return (CATEGORY_KEYS as readonly string[]).includes(key);
}

/**
 * Normalize UserProfile.settings without destructuring — invalid shapes become {}.
 */
export function normalizeRawSettings(
  value: Prisma.JsonValue | null | undefined,
): StoredUserSettings {
  if (value == null) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return normalizeRawSettings(parsed as Prisma.JsonValue);
    } catch {
      return {};
    }
  }

  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: StoredUserSettings = {};

  for (const key of Object.keys(value)) {
    if (!isCategoryKey(key)) {
      continue;
    }
    const category = value[key];
    if (isPlainObject(category)) {
      normalized[key] = category as StoredUserSettings[typeof key];
    }
  }

  return normalized;
}

function mergePlainObjects<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown> | undefined,
): T {
  if (!patch || !isPlainObject(patch)) {
    return { ...base };
  }

  const result = { ...base };
  for (const key of Object.keys(base)) {
    const value = patch[key];
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export function deepMergeStoredSettings(
  defaults: StoredUserSettings,
  raw: StoredUserSettings,
): StoredUserSettings {
  return {
    editorPreferences: mergePlainObjects(
      { ...DEFAULT_EDITOR_PREFERENCES, ...defaults.editorPreferences },
      raw.editorPreferences,
    ),
    collaborationPreferences: mergePlainObjects(
      {
        ...DEFAULT_COLLABORATION_PREFERENCES,
        ...defaults.collaborationPreferences,
      },
      raw.collaborationPreferences,
    ),
    privacyPreferences: mergePlainObjects(
      { ...DEFAULT_PRIVACY_PREFERENCES, ...defaults.privacyPreferences },
      raw.privacyPreferences,
    ),
    dataStoragePreferences: mergePlainObjects(
      {
        ...DEFAULT_DATA_STORAGE_PREFERENCES,
        ...defaults.dataStoragePreferences,
      },
      raw.dataStoragePreferences,
    ),
    accessibilityPreferences: mergePlainObjects(
      {
        ...DEFAULT_ACCESSIBILITY_PREFERENCES,
        ...defaults.accessibilityPreferences,
      },
      raw.accessibilityPreferences,
    ),
    experimentalPreferences: mergePlainObjects(
      {
        ...DEFAULT_EXPERIMENTAL_PREFERENCES,
        ...defaults.experimentalPreferences,
      },
      raw.experimentalPreferences,
    ),
  };
}

export function mergeCategoryPatch<T extends Record<string, unknown>>(
  current: T | undefined,
  patch: Partial<T> | undefined,
): T {
  const base = { ...(current ?? {}) } as T;
  if (!patch || !isPlainObject(patch)) {
    return base;
  }
  return mergePlainObjects(base, patch as Record<string, unknown>);
}

export function isSettingsPersistenceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: string; message?: string };
  if (record.code === 'P2022') {
    return true;
  }

  const message = String(record.message ?? '');
  return (
    message.includes('UserProfile.settings') ||
    message.includes('"settings"') ||
    message.includes('column') && message.includes('settings')
  );
}
