import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getCharacterOffsets, $getSelection, $isRangeSelection } from 'lexical';
import { useEffect } from 'react';
import {
  FLOWDOCS_CAPTURE_COMMENT_SELECTION,
  FLOWDOCS_COMMENT_SELECTION_READY,
} from './comment-selection-events';

export interface CommentSelectionCapturePluginProps {
  documentId: string;
}

/**
 * Listens for capture events and reports selection offsets/text only.
 * Does not apply any highlight or mutate editor styling.
 */
export function CommentSelectionCapturePlugin({
  documentId,
}: CommentSelectionCapturePluginProps) {
  const [editor] = useLexicalComposerContext();
  const canRun = Boolean(documentId && documentId.trim().length > 0);

  useEffect(() => {
    if (!canRun) return;
    const onCapture = (e: Event) => {
      const ce = e as CustomEvent<{ documentId: string }>;
      if (ce.detail?.documentId !== documentId) return;

      try {
        editor.update(
          () => {
            const sel = $getSelection();
            let anchorOffset: number | undefined;
            let focusOffset: number | undefined;
            let selectedText = '';

            if ($isRangeSelection(sel) && !sel.isCollapsed()) {
              const [a, f] = $getCharacterOffsets(sel);
              const min = Math.min(a, f);
              const max = Math.max(a, f);
              if (
                Number.isInteger(min) &&
                Number.isInteger(max) &&
                min >= 0 &&
                max >= 0 &&
                max >= min
              ) {
                anchorOffset = min;
                focusOffset = max;
                selectedText = sel.getTextContent();
              }
            }

            window.dispatchEvent(
              new CustomEvent(FLOWDOCS_COMMENT_SELECTION_READY, {
                detail: {
                  documentId,
                  hadRange:
                    anchorOffset !== undefined &&
                    focusOffset !== undefined &&
                    anchorOffset !== focusOffset,
                  anchorOffset,
                  focusOffset,
                  selectedText,
                },
              }),
            );
          },
          { discrete: true },
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent(FLOWDOCS_COMMENT_SELECTION_READY, {
            detail: {
              documentId,
              hadRange: false,
              selectedText: '',
            },
          }),
        );
      }
    };

    window.addEventListener(FLOWDOCS_CAPTURE_COMMENT_SELECTION, onCapture);
    return () =>
      window.removeEventListener(FLOWDOCS_CAPTURE_COMMENT_SELECTION, onCapture);
  }, [canRun, documentId, editor]);

  return null;
}
