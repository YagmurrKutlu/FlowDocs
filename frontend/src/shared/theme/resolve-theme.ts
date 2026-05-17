export type ResolvedColorScheme = 'dark';

/** Applies the fixed FlowDocs dark color scheme to the document root. */
export function applyThemeToDocument(scheme: ResolvedColorScheme = 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', scheme);
  document.documentElement.style.colorScheme = scheme;
  document.documentElement.setAttribute('data-mantine-color-scheme', scheme);
}
