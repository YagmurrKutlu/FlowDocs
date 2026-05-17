import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from 'lexical';
import { useEffect } from 'react';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import {
  clearFileAttachmentSelection,
  getActiveFileAttachmentKey,
  isFileAttachmentActionTarget,
  isFileAttachmentCardPointerTarget,
  isFileAttachmentToolbarPointerTarget,
  persistFileAttachmentSelection,
} from './fileAttachmentSelection';
import {
  logKeepToolbarBecauseAttachment,
  logKeepToolbarBecauseAttachmentToolbar,
  logOutsidePointerdownCloseToolbar,
} from './fileAttachmentUtils';

export function FileAttachmentSelectionPlugin() {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();

  useEffect(() => {
    if (!canEdit) return undefined;

    const unregisterClick = editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        const target = event.target;
        if (isFileAttachmentToolbarPointerTarget(target)) {
          return false;
        }
        if (isFileAttachmentActionTarget(target)) {
          return false;
        }
        const attachment =
          target instanceof Element
            ? target.closest<HTMLElement>('[data-flowdocs-file-attachment]')
            : null;
        if (!attachment) return false;

        const nodeKey = attachment.getAttribute('data-flowdocs-file-attachment-key');
        if (!nodeKey) return false;

        event.preventDefault();
        event.stopPropagation();
        persistFileAttachmentSelection(editor, nodeKey);
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const target = event.target;
      if (isFileAttachmentToolbarPointerTarget(target)) {
        logKeepToolbarBecauseAttachmentToolbar();
        return;
      }
      if (isFileAttachmentCardPointerTarget(target)) {
        logKeepToolbarBecauseAttachment();
        return;
      }
      if (!getActiveFileAttachmentKey()) return;

      logOutsidePointerdownCloseToolbar();
      clearFileAttachmentSelection(editor);
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => {
      unregisterClick();
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    };
  }, [canEdit, editor]);

  return null;
}
