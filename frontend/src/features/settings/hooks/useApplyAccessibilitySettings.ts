import { useEffect } from 'react';
import {
  applyAccessibilityPreferences,
  DEFAULT_ACCESSIBILITY_APPLIED,
} from '../utils/accessibilityPreferences';
import { useSettingsQuery } from './useSettingsQueries';

export function useApplyAccessibilitySettings(): void {
  const { data } = useSettingsQuery();

  useEffect(() => {
    applyAccessibilityPreferences(
      data?.accessibilityPreferences ?? DEFAULT_ACCESSIBILITY_APPLIED,
    );
  }, [data?.accessibilityPreferences]);
}
