import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Box } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import { $applyImageDropPlacement, $resolveImageDropPlacement, type ImageDropIndicator } from './image-drag-drop';
import {
  FLOWDOCS_IMAGE_DRAG_MIME,
  getFlowdocsImageDragActiveKey,
  setFlowdocsImageDragActiveKey,
} from './image-drag-session';

function hasImageDragMime(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  const list = Array.from(types);
  return list.includes(FLOWDOCS_IMAGE_DRAG_MIME) || list.includes('text/plain');
}

function readDraggedImageKeyFromDataTransfer(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  const custom = dt.getData(FLOWDOCS_IMAGE_DRAG_MIME)?.trim();
  if (custom) return custom;
  const plain = dt.getData('text/plain');
  if (plain.startsWith('flowdocs-image:')) {
    return plain.slice('flowdocs-image:'.length).trim() || null;
  }
  return null;
}

function pointInEditorRoot(el: HTMLElement, clientX: number, clientY: number): boolean {
  const r = el.getBoundingClientRect();
  return (
    clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  );
}

type DragHandlers = {
  root: HTMLElement;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
};

export function ImageDragDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [indicator, setIndicator] = useState<ImageDropIndicator | null>(null);
  const attachedRef = useRef<DragHandlers | null>(null);

  const detachRoot = () => {
    const prev = attachedRef.current;
    if (!prev) return;
    prev.root.removeEventListener('dragover', prev.onDragOver, true);
    prev.root.removeEventListener('drop', prev.onDrop, true);
    prev.root.removeEventListener('dragleave', prev.onDragLeave);
    attachedRef.current = null;
  };

  useEffect(() => {
    if (!canEdit) return;

    const onDragEndWindow = () => {
      setIndicator(null);
      // Let drop run first in the same tick; then clear session key.
      queueMicrotask(() => {
        setFlowdocsImageDragActiveKey(null);
      });
    };
    window.addEventListener('dragend', onDragEndWindow);

    const removeRootListener = editor.registerRootListener((rootEl, _prevRoot) => {
      detachRoot();

      if (rootEl === null) {
        setIndicator(null);
        return;
      }

      const el = rootEl as HTMLElement;

      const onDragOver = (e: DragEvent) => {
        if (!getFlowdocsImageDragActiveKey() && !hasImageDragMime(e)) return;
        if (!pointInEditorRoot(el, e.clientX, e.clientY)) return;
        const dragKey = getFlowdocsImageDragActiveKey();
        if (!dragKey) return;

        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }

        const resolved = $resolveImageDropPlacement(editor, e.clientX, e.clientY, dragKey);
        if (!resolved) {
          setIndicator(null);
          return;
        }
        setIndicator(resolved.indicator);
      };

      const onDrop = (e: DragEvent) => {
        if (!pointInEditorRoot(el, e.clientX, e.clientY)) return;
        e.preventDefault();
        e.stopPropagation();
        setIndicator(null);
        const dragKey =
          readDraggedImageKeyFromDataTransfer(e.dataTransfer) || getFlowdocsImageDragActiveKey();
        if (!dragKey) return;
        const resolved = $resolveImageDropPlacement(editor, e.clientX, e.clientY, dragKey);
        setFlowdocsImageDragActiveKey(null);
        if (!resolved) return;
        $applyImageDropPlacement(editor, dragKey, resolved.placement);
        editor.focus();
      };

      const onDragLeave = (e: DragEvent) => {
        const rel = e.relatedTarget;
        if (rel instanceof Node && el.contains(rel)) return;
        setIndicator(null);
      };

      el.addEventListener('dragover', onDragOver, true);
      el.addEventListener('drop', onDrop, true);
      el.addEventListener('dragleave', onDragLeave);
      attachedRef.current = { root: el, onDragOver, onDrop, onDragLeave };
    });

    return () => {
      window.removeEventListener('dragend', onDragEndWindow);
      detachRoot();
      removeRootListener();
    };
  }, [canEdit, editor]);

  if (!canEdit || !indicator) return null;

  return (
    <Box
      data-flowdocs-drop-indicator
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        top: indicator.top,
        left: indicator.left,
        width: indicator.width,
        height: 2,
        backgroundColor: 'var(--mantine-primary-color-filled)',
        zIndex: 1000,
        borderRadius: 1,
        opacity: 0.9,
        boxShadow: '0 0 4px rgba(0,0,0,0.35)',
      }}
    />
  );
}
