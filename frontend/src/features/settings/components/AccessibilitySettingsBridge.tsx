import { useApplyAccessibilitySettings } from '../hooks/useApplyAccessibilitySettings';

/** Applies accessibility preferences from settings to document root. */
export function AccessibilitySettingsBridge() {
  useApplyAccessibilitySettings();
  return null;
}
