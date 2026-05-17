const NAMED_COLORS = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'gray',
  'grey',
  'transparent',
  'currentcolor',
]);

export function sanitizeExportHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^\s*javascript:/i.test(trimmed) || /^\s*data:/i.test(trimmed)) {
    return null;
  }
  if (/^mailto:/i.test(trimmed)) {
    return escapeHtmlAttribute(trimmed);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return escapeHtmlAttribute(trimmed);
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return escapeHtmlAttribute(url.toString());
    }
  } catch {
    return null;
  }
  return null;
}

export function sanitizeCssColor(value?: string): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim().toLowerCase();
  if (NAMED_COLORS.has(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^hsla?\([^)]+\)$/i.test(trimmed)) return trimmed;
  return null;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
