import type { AccessibilityPreferences } from '../types/settings.types';

const ROOT = () =>
  typeof document !== 'undefined' ? document.documentElement : null;

export function applyAccessibilityPreferences(
  prefs: AccessibilityPreferences,
): void {
  const root = ROOT();
  if (!root) return;

  root.toggleAttribute('data-reduced-motion', prefs.reducedMotion);
  root.toggleAttribute('data-high-contrast', prefs.highContrast);
  root.toggleAttribute('data-large-text', prefs.largerText);
  root.toggleAttribute('data-visible-focus', prefs.visibleFocus);

  root.classList.toggle('flowdocs-reduced-motion', prefs.reducedMotion);
  root.classList.toggle('flowdocs-high-contrast', prefs.highContrast);
  root.classList.toggle('flowdocs-large-text', prefs.largerText);
  root.classList.toggle('flowdocs-visible-focus', prefs.visibleFocus);
}

export const DEFAULT_ACCESSIBILITY_APPLIED: AccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  largerText: false,
  visibleFocus: true,
};
