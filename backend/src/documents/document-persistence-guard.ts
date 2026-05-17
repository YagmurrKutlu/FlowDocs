/**
 * Pure persistence guard rules — shared by DocumentYjsPersistenceService and tests.
 */

export interface PersistenceGuardInput {
  documentEditorStateJson: string | null | undefined;
  documentPreviewContent: string | null | undefined;
  yjsBeforeHasContent: boolean;
  yjsAfterHasContent: boolean;
  incomingEditorStateJson?: string | null;
}

export function hasRichLexicalEditorStateJson(
  serialized: string | null | undefined,
): boolean {
  if (typeof serialized !== 'string') return false;
  const trimmed = serialized.trim();
  if (trimmed.length < 20) return false;
  try {
    const parsed = JSON.parse(trimmed) as {
      root?: { children?: unknown[] };
    };
    return Array.isArray(parsed?.root?.children) && parsed.root.children.length > 0;
  } catch {
    return trimmed.includes('"root"') && trimmed.includes('"children"');
  }
}

export function hasNonEmptyPreviewContent(
  preview: string | null | undefined,
): boolean {
  if (preview === null || preview === undefined) return false;
  if (typeof preview === 'string') return preview.trim().length > 0;
  return String(preview).trim().length > 0;
}

export function documentStoredStateHasContent(
  editorStateJson: string | null | undefined,
  previewContent: string | null | undefined,
): boolean {
  return (
    hasRichLexicalEditorStateJson(editorStateJson) ||
    hasNonEmptyPreviewContent(previewContent)
  );
}

export function evaluateDestructiveEmptyRejection(
  input: PersistenceGuardInput,
): boolean {
  const storedHasContent = documentStoredStateHasContent(
    input.documentEditorStateJson,
    input.documentPreviewContent,
  );
  const hadSubstantiveContent =
    storedHasContent || input.yjsBeforeHasContent;
  const incomingJsonHasContent = hasRichLexicalEditorStateJson(
    input.incomingEditorStateJson,
  );

  return (
    hadSubstantiveContent &&
    !input.yjsAfterHasContent &&
    !incomingJsonHasContent
  );
}
