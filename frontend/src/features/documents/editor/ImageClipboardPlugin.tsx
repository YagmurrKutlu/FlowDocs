import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
} from 'lexical';
import type { LexicalEditor } from 'lexical';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import { getFlowdocsImageClipboard, setFlowdocsImageClipboard } from './image-clipboard-store';
import { $insertClonedImageFromSerialized } from './image-insert';
import { $isImageNode, $selectImageNodeIfPresent, type SerializedImageNode } from './nodes/ImageNode';

function tryCopyImageFromNodeSelection(editor: LexicalEditor): SerializedImageNode | null {
  return editor.getEditorState().read(() => {
    const sel = $getSelection();
    if (!$isNodeSelection(sel)) return null;
    const images = sel.getNodes().filter($isImageNode);
    if (images.length === 0) return null;
    return images[0]!.exportJSON() as SerializedImageNode;
  });
}

export function ImageClipboardPlugin() {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();

  useEffect(() => {
    if (!canEdit) return;

    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          const shouldClearImageSelection = editor.getEditorState().read(() => {
            const s = $getSelection();
            if (!$isNodeSelection(s)) return false;
            return s.getNodes().some($isImageNode);
          });
          if (shouldClearImageSelection) {
            event.preventDefault();
            editor.update(() => {
              const s = $getSelection();
              if ($isNodeSelection(s)) {
                s.clear();
              }
            });
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console -- dev-only image selection debug
              console.log('[image-node] selection cleared');
            }
            return true;
          }
        }

        const sel = editor.getEditorState().read(() => $getSelection());

        if (event.key === 'Backspace' || event.key === 'Delete') {
          if (!$isNodeSelection(sel)) return false;
          const nodes = sel.getNodes();
          if (nodes.length === 0 || !nodes.every($isImageNode)) return false;
          event.preventDefault();
          editor.update(() => {
            const live = $getSelection();
            if (!$isNodeSelection(live)) return;
            for (const n of live.getNodes()) {
              if ($isImageNode(n)) n.remove();
            }
          });
          return true;
        }

        const mod = event.ctrlKey || event.metaKey;
        if (!mod) return false;
        const key = event.key.toLowerCase();

        if (key === 'c') {
          const data = tryCopyImageFromNodeSelection(editor);
          if (!data) return false;
          event.preventDefault();
          setFlowdocsImageClipboard(data);
          return true;
        }

        if (key === 'x') {
          const data = tryCopyImageFromNodeSelection(editor);
          if (!data) return false;
          event.preventDefault();
          setFlowdocsImageClipboard(data);
          editor.update(() => {
            const live = $getSelection();
            if (!$isNodeSelection(live)) return;
            for (const n of live.getNodes()) {
              if ($isImageNode(n)) n.remove();
            }
          });
          return true;
        }

        if (key === 'v') {
          const payload = getFlowdocsImageClipboard();
          if (!payload || payload.type !== 'image') return false;
          event.preventDefault();
          editor.update(() => {
            const inserted = $insertClonedImageFromSerialized(payload);
            const k = inserted.getKey();
            if ($selectImageNodeIfPresent(k) && import.meta.env.DEV) {
              // eslint-disable-next-line no-console -- dev-only image selection debug
              console.log('[image-node] restored selection', { nodeKey: k, reason: 'paste-shortcut' });
            }
          });
          editor.focus();
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [canEdit, editor]);

  return null;
}
