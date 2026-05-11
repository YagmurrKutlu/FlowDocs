import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowDown,
  IconArrowUp,
  IconClipboard,
  IconCopy,
  IconCut,
  IconTrash,
} from '@tabler/icons-react';
import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  DecoratorNode,
  KEY_DOWN_COMMAND,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useAuthStore } from '../../../../store/auth.store';
import { getFlowdocsImageClipboard, setFlowdocsImageClipboard } from '../image-clipboard-store';
import { FLOWDOCS_IMAGE_DRAG_MIME, setFlowdocsImageDragActiveKey } from '../image-drag-session';
import { $insertClonedImageFromSerialized } from '../image-insert';
import { useDocumentEditorCanEdit } from '../DocumentEditorCapabilitiesContext';
import { isBrowserAuthenticatedMediaUrl } from '../../utils/confirm-media-url';

export type ImageAlign = 'left' | 'center' | 'right';
export type ImageLayoutMode = 'flow' | 'floating';

const WIDTH_SMALL = '240px';
const WIDTH_MEDIUM = '420px';
const WIDTH_LARGE = '720px';
const WIDTH_FULL = '100%';

const MIN_IMAGE_WIDTH_PX = 120;
const FLOATING_TOOLBAR_OFFSET_PX = 56;
const FLOATING_CANVAS_MIN_EXTRA_PX = 120;
const FLOATING_CANVAS_BOTTOM_PADDING_PX = 24;

/** Must match `DocumentEditorShell` / Yjs bridge so the selection guard can detect remote merges. */
const SYNC_FROM_YJS_TAG = 'sync-from-yjs';
/** Tag for `editor.update` from the selection guard — avoids recursive guard work in `registerUpdateListener`. */
const IMAGE_SELECTION_GUARD_TAG = 'image-selection-guard-restore';

const invalidImageStyle = {
  color: 'var(--mantine-color-dimmed)',
  fontSize: 12,
} as const;

const toolbarShell: CSSProperties = {
  marginTop: 6,
  padding: '6px 8px',
  borderRadius: 8,
  backgroundColor: 'var(--mantine-color-dark-5)',
  border: '1px solid var(--mantine-color-dark-3)',
  boxShadow: '0 0 8px rgba(0,0,0,0.35)',
};

function getMaxImageWidthPx(editor: LexicalEditor): number {
  const root = editor.getRootElement();
  if (!root) return 800;
  const shell = root.closest('.flowdocs-editor-content');
  const el = shell instanceof HTMLElement ? shell : root;
  const w = el.getBoundingClientRect().width;
  return Math.max(MIN_IMAGE_WIDTH_PX, Math.floor(w - 24));
}

function parseWidthToPx(width: string, measuredFallback: number): number {
  const t = width.trim();
  if (t === '100%') return measuredFallback;
  const m = /^(\d+(?:\.\d+)?)px$/.exec(t);
  if (m) return Math.round(Number(m[1]));
  return measuredFallback;
}

function readImageNodePayload(
  editor: LexicalEditor,
  nodeKey: NodeKey,
): {
  src: string;
  alt: string;
  width: string;
  align: ImageAlign;
  layoutMode: ImageLayoutMode;
  x: number;
  y: number;
} | null {
  return editor.getEditorState().read(() => {
    const n = $getNodeByKey(nodeKey);
    if (!$isImageNode(n)) return null;
    return {
      src: n.__src,
      alt: n.__altText,
      width: n.__width,
      align: n.__align,
      layoutMode: n.__layoutMode,
      x: n.__x,
      y: n.__y,
    };
  });
}

function sanitizeAlign(value: unknown): ImageAlign {
  if (value === 'left' || value === 'center' || value === 'right') {
    return value;
  }
  return 'center';
}

function sanitizeLayoutMode(value: unknown): ImageLayoutMode {
  return value === 'floating' ? 'floating' : 'flow';
}

function sanitizeCanvasCoordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getFloatingCanvasHeight(imageHeightPx: number, y: number): number {
  return Math.max(
    Math.round(
      FLOATING_TOOLBAR_OFFSET_PX +
        imageHeightPx +
        Math.max(0, y) +
        FLOATING_CANVAS_BOTTOM_PADDING_PX,
    ),
    Math.round(imageHeightPx + FLOATING_CANVAS_MIN_EXTRA_PX),
  );
}

function clampFloatingX(x: number, canvasWidthPx: number, imageWidthPx: number): number {
  const maxX = Math.max(0, Math.round(canvasWidthPx - imageWidthPx));
  return Math.min(Math.max(0, Math.round(x)), maxX);
}

function clampFloatingY(y: number, imageHeightPx: number, canvasHeightPx: number): number {
  const maxY = Math.max(
    0,
    Math.round(
      canvasHeightPx -
        FLOATING_TOOLBAR_OFFSET_PX -
        imageHeightPx -
        FLOATING_CANVAS_BOTTOM_PADDING_PX,
    ),
  );
  return Math.min(Math.max(0, Math.round(y)), maxY);
}

function sanitizeWidth(value: unknown, maxPx = 4000): string {
  if (typeof value !== 'string' || !value.trim()) return WIDTH_FULL;
  const t = value.trim();
  if (t === '100%') return '100%';
  const allowed = new Set([WIDTH_SMALL, WIDTH_MEDIUM, WIDTH_LARGE, WIDTH_FULL]);
  if (allowed.has(t)) {
    if (t === WIDTH_FULL) return WIDTH_FULL;
    const px = parseWidthToPx(t, MIN_IMAGE_WIDTH_PX);
    const cap = Math.min(Math.max(px, MIN_IMAGE_WIDTH_PX), Math.max(maxPx, MIN_IMAGE_WIDTH_PX));
    return `${cap}px`;
  }
  const m = /^(\d+(?:\.\d+)?)px$/.exec(t);
  if (m) {
    const px = Math.round(Number(m[1]));
    const clamped = Math.min(Math.max(px, MIN_IMAGE_WIDTH_PX), Math.max(maxPx, MIN_IMAGE_WIDTH_PX));
    return `${clamped}px`;
  }
  return WIDTH_FULL;
}

function $moveImageNodeUp(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!$isImageNode(node)) return false;
  const prev = node.getPreviousSibling();
  if (!prev) return false;
  prev.insertBefore(node);
  return true;
}

function $moveImageNodeDown(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!$isImageNode(node)) return false;
  const next = node.getNextSibling();
  if (!next) return false;
  next.insertAfter(node);
  return true;
}

/** Set Lexical NodeSelection to the image at `key` when that node still exists. */
export function $selectImageNodeIfPresent(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!(node && node.getType() === 'image')) return false;
  const sel = $createNodeSelection();
  sel.add(key);
  $setSelection(sel);
  return true;
}

function ImageDecoratorView({
  src,
  alt,
  width,
}: {
  src: string;
  alt: string;
  width: string;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [failed, setFailed] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const needsAuthFetch = isBrowserAuthenticatedMediaUrl(src);

  const imgStyle: CSSProperties = {
    width,
    maxWidth: '100%',
    height: 'auto',
    borderRadius: 8,
    display: 'block',
    boxSizing: 'border-box',
  };

  useEffect(() => {
    if (!needsAuthFetch) {
      setBlobUrl(null);
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setBlobUrl(null);
    setAuthLoading(true);
    setFailed(false);

    const token = accessToken;
    if (!token) {
      setFailed(true);
      setAuthLoading(false);
      return;
    }

    void fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [accessToken, needsAuthFetch, src]);

  if (failed) {
    return <span style={invalidImageStyle}>Invalid image</span>;
  }

  if (needsAuthFetch) {
    if (authLoading || !blobUrl) {
      return (
        <span style={invalidImageStyle} aria-busy="true">
          Loading image…
        </span>
      );
    }
    return <img src={blobUrl} alt={alt} draggable={false} style={imgStyle} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      style={imgStyle}
    />
  );
}

function ImageBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [hover, setHover] = useState(false);
  const [payload, setPayload] = useState(() => readImageNodePayload(editor, nodeKey));
  const innerWrapRef = useRef<HTMLDivElement>(null);
  const floatingCanvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragJustEndedRef = useRef(false);
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [resizeDragWidth, setResizeDragWidth] = useState<string | null>(null);
  const resizeDragWidthRef = useRef<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const floatingDragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const floatingDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [floatingDragPosition, setFloatingDragPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [imageMetrics, setImageMetrics] = useState({ width: 320, height: 220 });
  const lastSelectedRef = useRef(false);
  const [lastSelectedUi, setLastSelectedUi] = useState(false);
  const prevLexicalRef = useRef(
    editor.getEditorState().read(() => {
      const s = $getSelection();
      return $isNodeSelection(s) && s.has(nodeKey);
    }),
  );
  const [lexicalSelectsThisNode, setLexicalSelectsThisNode] = useState(() =>
    editor.getEditorState().read(() => {
      const s = $getSelection();
      return $isNodeSelection(s) && s.has(nodeKey);
    }),
  );

  const syncLastSelected = useCallback((next: boolean) => {
    lastSelectedRef.current = next;
    setLastSelectedUi(next);
  }, []);
  const layoutMode = payload?.layoutMode ?? 'flow';
  const currentX = payload?.x ?? 0;
  const currentY = payload?.y ?? 0;

  useEffect(() => {
    const imgEl = innerWrapRef.current?.querySelector('img');
    if (!(imgEl instanceof HTMLImageElement)) return;

    const updateMetrics = () => {
      const rect = imgEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setImageMetrics({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateMetrics();
    imgEl.addEventListener('load', updateMetrics);

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateMetrics);
      observer.observe(imgEl);
      return () => {
        imgEl.removeEventListener('load', updateMetrics);
        observer.disconnect();
      };
    }

    window.addEventListener('resize', updateMetrics);
    return () => {
      imgEl.removeEventListener('load', updateMetrics);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [payload?.src, payload?.width, resizeDragWidth]);

  useEffect(() => {
    return editor.registerUpdateListener((payload) => {
      const tagSet = payload.tags ?? new Set<string>();
      const nextPayload = readImageNodePayload(editor, nodeKey);
      setPayload(nextPayload);

      const nextLexical = editor.getEditorState().read(() => {
        const s = $getSelection();
        return $isNodeSelection(s) && s.has(nodeKey);
      });
      setLexicalSelectsThisNode(nextLexical);

      if (!nextPayload) {
        syncLastSelected(false);
        prevLexicalRef.current = false;
        return;
      }

      if (tagSet.has(IMAGE_SELECTION_GUARD_TAG)) {
        prevLexicalRef.current = nextLexical;
        return;
      }

      if (prevLexicalRef.current && !nextLexical && !tagSet.has(SYNC_FROM_YJS_TAG)) {
        syncLastSelected(false);
      }

      if (nextLexical && !lastSelectedRef.current) {
        syncLastSelected(true);
      }

      if (
        canEdit &&
        !isResizingRef.current &&
        lastSelectedRef.current &&
        !nextLexical &&
        nextPayload
      ) {
        queueMicrotask(() => {
          editor.update(
            () => {
              if (!lastSelectedRef.current || isResizingRef.current) return;
              if (!readImageNodePayload(editor, nodeKey)) {
                syncLastSelected(false);
                return;
              }
              if (
                editor.getEditorState().read(() => {
                  const s = $getSelection();
                  return $isNodeSelection(s) && s.has(nodeKey);
                })
              ) {
                return;
              }
              if ($selectImageNodeIfPresent(nodeKey) && import.meta.env.DEV) {
                // eslint-disable-next-line no-console -- dev-only image selection debug
                console.log('[image-node] restored selection', { nodeKey, reason: 'selection-guard' });
              }
            },
            { tag: IMAGE_SELECTION_GUARD_TAG },
          );
        });
      }

      prevLexicalRef.current = nextLexical;
    });
  }, [canEdit, editor, nodeKey, syncLastSelected]);

  const commit = useCallback(
    (fn: (node: ImageNode) => void) => {
      editor.update(() => {
        const n = $getNodeByKey(nodeKey);
        if (!$isImageNode(n)) return;
        fn(n.getWritable());
        if ($selectImageNodeIfPresent(nodeKey)) {
          syncLastSelected(true);
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console -- dev-only image selection debug
            console.log('[image-node] restored selection', { nodeKey, reason: 'commit' });
          }
        }
      });
    },
    [editor, nodeKey, syncLastSelected],
  );

  useEffect(() => {
    if (!canEdit) return;
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return false;
        const isOurImageSelected = editor.getEditorState().read(() => {
          const s = $getSelection();
          return $isNodeSelection(s) && s.has(nodeKey);
        });
        if (isOurImageSelected) {
          syncLastSelected(false);
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [canEdit, editor, nodeKey, syncLastSelected]);

  useEffect(() => {
    if (!canEdit) return;
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (isDraggingRef.current) {
          return false;
        }
        if (dragJustEndedRef.current) {
          const wrap = innerWrapRef.current;
          const t = event.target;
          const suppress = wrap && t instanceof Node && wrap.contains(t);
          dragJustEndedRef.current = false;
          if (suppress) {
            return false;
          }
        }
        const rootElem = editor.getElementByKey(nodeKey);
        const inner = innerWrapRef.current;
        const target = event.target;
        const insideLexicalShell =
          target instanceof Node &&
          rootElem !== null &&
          rootElem !== undefined &&
          rootElem.contains(target);
        const insideInner =
          target instanceof Node && inner !== null && inner !== undefined && inner.contains(target);
        if (!insideLexicalShell && !insideInner) {
          return false;
        }
        const el = event.target as HTMLElement;
        if (
          el.closest('[data-flowdocs-image-toolbar]') ||
          el.closest('[data-flowdocs-image-resize-handle]')
        ) {
          return false;
        }
        event.preventDefault();
        event.stopPropagation();

        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (!$isImageNode(node)) return;
          const current = $getSelection();
          if (event.shiftKey && $isNodeSelection(current)) {
            if (current.has(nodeKey)) {
              current.delete(nodeKey);
            } else {
              current.add(nodeKey);
            }
          } else {
            const next = $createNodeSelection();
            next.add(nodeKey);
            $setSelection(next);
          }
        });
        editor.focus();
        syncLastSelected(
          editor.getEditorState().read(() => {
            const s = $getSelection();
            return $isNodeSelection(s) && s.has(nodeKey);
          }),
        );
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- dev-only image selection debug
          console.log('[image-node] selected', { nodeKey });
        }
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [canEdit, editor, nodeKey, syncLastSelected]);

  const onResizeHandleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!payload) return;

      setIsResizing(true);
      isResizingRef.current = true;
      syncLastSelected(true);
      editor.update(() => {
        $selectImageNodeIfPresent(nodeKey);
      });
      editor.focus();

      const maxPx = getMaxImageWidthPx(editor);
      const imgEl = innerWrapRef.current?.querySelector('img');
      const measured = imgEl?.getBoundingClientRect().width ?? 320;
      const startX = event.clientX;
      const startW = parseWidthToPx(payload.width, measured);

      const onMove = (ev: globalThis.MouseEvent) => {
        const dx = ev.clientX - startX;
        const raw = startW + dx;
        const clamped = Math.min(Math.max(raw, MIN_IMAGE_WIDTH_PX), maxPx);
        const next = `${Math.round(clamped)}px`;
        resizeDragWidthRef.current = next;
        setResizeDragWidth(next);
      };

      let resizeEnded = false;
      const onUp = () => {
        if (resizeEnded) return;
        resizeEnded = true;
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        window.removeEventListener('blur', onUp, true);
        const final = resizeDragWidthRef.current;
        resizeDragWidthRef.current = null;
        setResizeDragWidth(null);
        const cap = getMaxImageWidthPx(editor);
        editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if (!$isImageNode(n)) return;
          if (final) {
            n.setWidth(final, cap);
            if (payload.layoutMode === 'floating') {
              const imageWidthPx = Math.min(
                cap,
                Math.max(parseWidthToPx(final, imageMetrics.width), MIN_IMAGE_WIDTH_PX),
              );
              const imageHeightPx = Math.max(80, imageMetrics.height);
              n.setFloatingPosition(
                currentX,
                currentY,
                cap,
                imageWidthPx,
                imageHeightPx,
                getFloatingCanvasHeight(imageHeightPx, currentY),
              );
            }
          }
          if ($selectImageNodeIfPresent(nodeKey)) {
            syncLastSelected(true);
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console -- dev-only image selection debug
              console.log('[image-node] restored selection', { nodeKey, reason: 'resize-commit' });
            }
          }
        });
        editor.focus();
        requestAnimationFrame(() => {
          editor.update(
            () => {
              $selectImageNodeIfPresent(nodeKey);
            },
            { tag: IMAGE_SELECTION_GUARD_TAG },
          );
          editor.focus();
          isResizingRef.current = false;
          setIsResizing(false);
        });
        if (import.meta.env.DEV && final) {
          // eslint-disable-next-line no-console -- dev-only image resize debug
          console.log('[image-node] resize commit', { nodeKey, width: final });
        }
      };

      resizeDragWidthRef.current = null;
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
      window.addEventListener('blur', onUp, true);
    },
    [editor, nodeKey, payload, syncLastSelected],
  );

  const copyThisImage = useCallback(() => {
    const data = editor.getEditorState().read(() => {
      const n = $getNodeByKey(nodeKey);
      if (!$isImageNode(n)) return null;
      return n.exportJSON() as SerializedImageNode;
    });
    if (data) setFlowdocsImageClipboard(data);
  }, [editor, nodeKey]);

  const cutThisImage = useCallback(() => {
    copyThisImage();
    syncLastSelected(false);
    commit((n) => n.remove());
  }, [commit, copyThisImage, syncLastSelected]);

  const pasteFromClipboard = useCallback(() => {
    const clip = getFlowdocsImageClipboard();
    if (!clip || clip.type !== 'image') return;
    syncLastSelected(false);
    editor.update(() => {
      const inserted = $insertClonedImageFromSerialized(clip);
      const k = inserted.getKey();
      if ($selectImageNodeIfPresent(k) && import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only image selection debug
        console.log('[image-node] restored selection', { nodeKey: k, reason: 'paste-toolbar' });
      }
    });
    editor.focus();
  }, [editor, syncLastSelected]);

  const onFlowdocsImageDragStart = useCallback(
    (e: ReactDragEvent) => {
      if (!canEdit || !payload || payload.layoutMode !== 'flow') return;
      e.stopPropagation();
      isDraggingRef.current = true;
      setIsDraggingVisual(true);
      setFlowdocsImageDragActiveKey(nodeKey);
      e.dataTransfer.setData(FLOWDOCS_IMAGE_DRAG_MIME, nodeKey);
      // Some browsers only expose payload on drop for custom MIME; keep a text fallback.
      e.dataTransfer.setData('text/plain', `flowdocs-image:${nodeKey}`);
      e.dataTransfer.effectAllowed = 'move';
    },
    [canEdit, nodeKey, payload],
  );

  const onFlowdocsImageDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setIsDraggingVisual(false);
    dragJustEndedRef.current = true;
  }, []);

  const onInnerWrapMouseDown = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const onFloatingToggle = useCallback(() => {
    const canvasWidthPx = getMaxImageWidthPx(editor);
    const imageWidthPx = Math.min(
      canvasWidthPx,
      Math.max(parseWidthToPx(payload?.width ?? WIDTH_FULL, imageMetrics.width), MIN_IMAGE_WIDTH_PX),
    );
    const imageHeightPx = Math.max(80, imageMetrics.height);
    commit((n) => {
      n.setLayoutMode(
        layoutMode === 'floating' ? 'flow' : 'floating',
        canvasWidthPx,
        imageWidthPx,
        imageHeightPx,
      );
    });
  }, [commit, editor, imageMetrics.height, imageMetrics.width, layoutMode, payload?.width]);

  const onFloatingDragMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (!canEdit || layoutMode !== 'floating') {
        onInnerWrapMouseDown();
        return;
      }
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-flowdocs-image-resize-handle]')) return;

      onInnerWrapMouseDown();
      event.preventDefault();
      event.stopPropagation();
      syncLastSelected(true);
      editor.update(() => {
        $selectImageNodeIfPresent(nodeKey);
      });
      editor.focus();

      const canvasWidthPx = getMaxImageWidthPx(editor);
      const imageWidthPx = Math.min(
        canvasWidthPx,
        Math.max(parseWidthToPx(payload?.width ?? WIDTH_FULL, imageMetrics.width), MIN_IMAGE_WIDTH_PX),
      );
      const imageHeightPx = Math.max(80, imageMetrics.height);
      const start = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: clampFloatingX(currentX, canvasWidthPx, imageWidthPx),
        startY: clampFloatingY(currentY, imageHeightPx, getFloatingCanvasHeight(imageHeightPx, currentY)),
        moved: false,
      };
      floatingDragStateRef.current = start;

      const onMove = (ev: globalThis.MouseEvent) => {
        const state = floatingDragStateRef.current;
        if (!state) return;
        const dx = ev.clientX - state.startClientX;
        const dy = ev.clientY - state.startClientY;
        if (!state.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        state.moved = true;
        isDraggingRef.current = true;
        setIsDraggingVisual(true);
        const rawY = state.startY + dy;
        const canvasHeightPx = getFloatingCanvasHeight(imageHeightPx, rawY);
        const next = {
          x: clampFloatingX(state.startX + dx, canvasWidthPx, imageWidthPx),
          y: clampFloatingY(rawY, imageHeightPx, canvasHeightPx),
        };
        floatingDragPositionRef.current = next;
        setFloatingDragPosition(next);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        window.removeEventListener('blur', onUp, true);

        const state = floatingDragStateRef.current;
        floatingDragStateRef.current = null;
        const finalPos = floatingDragPositionRef.current;
        floatingDragPositionRef.current = null;
        setFloatingDragPosition(null);
        setIsDraggingVisual(false);
        isDraggingRef.current = false;

        if (!state?.moved || !finalPos) return;

        dragJustEndedRef.current = true;
        commit((n) => {
          n.setFloatingPosition(
            finalPos.x,
            finalPos.y,
            canvasWidthPx,
            imageWidthPx,
            imageHeightPx,
            getFloatingCanvasHeight(imageHeightPx, finalPos.y),
          );
        });
      };

      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
      window.addEventListener('blur', onUp, true);
    },
    [
      canEdit,
      commit,
      currentX,
      currentY,
      editor,
      imageMetrics.height,
      imageMetrics.width,
      layoutMode,
      nodeKey,
      onInnerWrapMouseDown,
      payload?.width,
      syncLastSelected,
    ],
  );

  if (!payload) {
    return null;
  }

  const { src, alt, width, align } = payload;
  const safeSrc = typeof src === 'string' ? src.trim() : '';
  if (!safeSrc) {
    return <span style={invalidImageStyle}>Invalid image</span>;
  }

  const outerAlign: CSSProperties['textAlign'] = align;
  const displayWidth = resizeDragWidth ?? width;
  const canvasWidthPx = getMaxImageWidthPx(editor);
  const imageWidthPx = Math.min(
    canvasWidthPx,
    Math.max(parseWidthToPx(displayWidth, imageMetrics.width), MIN_IMAGE_WIDTH_PX),
  );
  const imageHeightPx = Math.max(80, imageMetrics.height);
  const displayX =
    layoutMode === 'floating'
      ? floatingDragPosition?.x ?? clampFloatingX(currentX, canvasWidthPx, imageWidthPx)
      : 0;
  const displayY =
    layoutMode === 'floating'
      ? floatingDragPosition?.y ??
        clampFloatingY(currentY, imageHeightPx, getFloatingCanvasHeight(imageHeightPx, currentY))
      : 0;
  const floatingCanvasHeight =
    layoutMode === 'floating' ? getFloatingCanvasHeight(imageHeightPx, displayY) : 0;
  const floatingImageTop = layoutMode === 'floating' ? FLOATING_TOOLBAR_OFFSET_PX + displayY : 0;
  const showChrome = Boolean(
    canEdit && (lexicalSelectsThisNode || isResizing || lastSelectedUi),
  );

  return (
    <div
      style={{
        textAlign: layoutMode === 'flow' ? outerAlign : undefined,
        position: 'relative',
        margin: '8px 0',
      }}
    >
      <div
        ref={layoutMode === 'floating' ? floatingCanvasRef : undefined}
        style={{
          display: layoutMode === 'floating' ? 'block' : 'inline-block',
          position: layoutMode === 'floating' ? 'relative' : undefined,
          width: layoutMode === 'floating' ? '100%' : undefined,
          maxWidth: '100%',
          verticalAlign: 'top',
          minHeight: layoutMode === 'floating' ? floatingCanvasHeight : undefined,
        }}
      >
        <div
          ref={innerWrapRef}
          className="flowdocs-image-node-inner"
          draggable={Boolean(canEdit && layoutMode === 'flow')}
          onDragEnd={onFlowdocsImageDragEnd}
          onDragStart={onFlowdocsImageDragStart}
          onMouseDown={layoutMode === 'floating' ? onFloatingDragMouseDown : onInnerWrapMouseDown}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: layoutMode === 'floating' ? 'absolute' : 'relative',
            left: layoutMode === 'floating' ? displayX : undefined,
            top: layoutMode === 'floating' ? floatingImageTop : undefined,
            borderRadius: 10,
            transition: 'box-shadow 120ms ease, opacity 120ms ease',
            outline: showChrome
              ? '2px solid var(--mantine-primary-color-filled)'
              : '2px solid transparent',
            outlineOffset: 2,
            opacity: isDraggingVisual ? 0.5 : hover && !showChrome ? 0.94 : 1,
            boxShadow: hover && !showChrome ? '0 0 0 1px var(--mantine-color-dark-2)' : undefined,
            cursor: canEdit ? (isDraggingVisual ? 'grabbing' : 'grab') : undefined,
          }}
        >
          <ImageDecoratorView src={safeSrc} alt={alt} width={displayWidth} />
          {showChrome ? (
            <div
              data-flowdocs-image-resize-handle
              draggable={false}
              onMouseDown={onResizeHandleMouseDown}
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: 'var(--mantine-color-dark-2)',
                border: '1px solid var(--mantine-color-dark-0)',
                cursor: 'nwse-resize',
                zIndex: 2,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
              aria-label="Resize image"
              role="presentation"
            />
          ) : null}
        </div>
        {showChrome ? (
          <Group
            data-flowdocs-image-toolbar
            gap={4}
            wrap="wrap"
            justify="center"
            onMouseDown={(e) => e.preventDefault()}
            style={
              layoutMode === 'floating'
                ? {
                    ...toolbarShell,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 3,
                    marginTop: 0,
                  }
                : toolbarShell
            }
          >
            <Tooltip label="Toggle floating mode" withArrow position="top">
              <Button
                size="compact-xs"
                variant={layoutMode === 'floating' ? 'light' : 'subtle'}
                color="gray"
                px={6}
                h={24}
                fz={10}
                onClick={onFloatingToggle}
              >
                Floating
              </Button>
            </Tooltip>
            <Tooltip label="Align left" withArrow position="top">
              <ActionIcon
                size="sm"
                variant={layoutMode === 'flow' && align === 'left' ? 'light' : 'subtle'}
                color="gray"
                aria-label="Align left"
                onClick={() =>
                  commit((n) => {
                    if (layoutMode === 'floating') {
                      n.setFloatingPosition(
                        0,
                        displayY,
                        canvasWidthPx,
                        imageWidthPx,
                        imageHeightPx,
                        floatingCanvasHeight,
                      );
                    } else {
                      n.setAlign('left');
                    }
                  })
                }
              >
                <IconAlignLeft size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align center" withArrow position="top">
              <ActionIcon
                size="sm"
                variant={layoutMode === 'flow' && align === 'center' ? 'light' : 'subtle'}
                color="gray"
                aria-label="Align center"
                onClick={() =>
                  commit((n) => {
                    if (layoutMode === 'floating') {
                      n.setFloatingPosition(
                        Math.max(0, Math.round((canvasWidthPx - imageWidthPx) / 2)),
                        displayY,
                        canvasWidthPx,
                        imageWidthPx,
                        imageHeightPx,
                        floatingCanvasHeight,
                      );
                    } else {
                      n.setAlign('center');
                    }
                  })
                }
              >
                <IconAlignCenter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align right" withArrow position="top">
              <ActionIcon
                size="sm"
                variant={layoutMode === 'flow' && align === 'right' ? 'light' : 'subtle'}
                color="gray"
                aria-label="Align right"
                onClick={() =>
                  commit((n) => {
                    if (layoutMode === 'floating') {
                      n.setFloatingPosition(
                        Math.max(0, Math.round(canvasWidthPx - imageWidthPx)),
                        displayY,
                        canvasWidthPx,
                        imageWidthPx,
                        imageHeightPx,
                        floatingCanvasHeight,
                      );
                    } else {
                      n.setAlign('right');
                    }
                  })
                }
              >
                <IconAlignRight size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Copy" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Copy image"
                onClick={copyThisImage}
              >
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Cut" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Cut image"
                onClick={cutThisImage}
              >
                <IconCut size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Paste" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Paste image from FlowDocs clipboard"
                onClick={pasteFromClipboard}
              >
                <IconClipboard size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move up" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Move image up"
                onClick={() => {
                  editor.update(() => {
                    $moveImageNodeUp(nodeKey);
                    if ($selectImageNodeIfPresent(nodeKey) && import.meta.env.DEV) {
                      // eslint-disable-next-line no-console -- dev-only image selection debug
                      console.log('[image-node] restored selection', { nodeKey, reason: 'move-up' });
                    }
                  });
                  syncLastSelected(true);
                }}
              >
                <IconArrowUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move down" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Move image down"
                onClick={() => {
                  editor.update(() => {
                    $moveImageNodeDown(nodeKey);
                    if ($selectImageNodeIfPresent(nodeKey) && import.meta.env.DEV) {
                      // eslint-disable-next-line no-console -- dev-only image selection debug
                      console.log('[image-node] restored selection', {
                        nodeKey,
                        reason: 'move-down',
                      });
                    }
                  });
                  syncLastSelected(true);
                }}
              >
                <IconArrowDown size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Small (240px)" withArrow position="top">
              <Button
                size="compact-xs"
                variant={width === WIDTH_SMALL ? 'light' : 'subtle'}
                color="gray"
                px={6}
                h={24}
                fz={10}
                onClick={() =>
                  commit((n) => {
                    n.setWidth(WIDTH_SMALL, getMaxImageWidthPx(editor));
                  })
                }
              >
                S
              </Button>
            </Tooltip>
            <Tooltip label="Medium (420px)" withArrow position="top">
              <Button
                size="compact-xs"
                variant={width === WIDTH_MEDIUM ? 'light' : 'subtle'}
                color="gray"
                px={6}
                h={24}
                fz={10}
                onClick={() =>
                  commit((n) => {
                    n.setWidth(WIDTH_MEDIUM, getMaxImageWidthPx(editor));
                  })
                }
              >
                M
              </Button>
            </Tooltip>
            <Tooltip label="Large (720px)" withArrow position="top">
              <Button
                size="compact-xs"
                variant={width === WIDTH_LARGE ? 'light' : 'subtle'}
                color="gray"
                px={6}
                h={24}
                fz={10}
                onClick={() =>
                  commit((n) => {
                    n.setWidth(WIDTH_LARGE, getMaxImageWidthPx(editor));
                  })
                }
              >
                L
              </Button>
            </Tooltip>
            <Tooltip label="Full width" withArrow position="top">
              <Button
                size="compact-xs"
                variant={width === WIDTH_FULL ? 'light' : 'subtle'}
                color="gray"
                px={6}
                h={24}
                fz={10}
                onClick={() =>
                  commit((n) => {
                    n.setWidth(WIDTH_FULL, getMaxImageWidthPx(editor));
                  })
                }
              >
                Full
              </Button>
            </Tooltip>
            <Tooltip label="Delete image" withArrow position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                aria-label="Delete image"
                onClick={() => {
                  syncLastSelected(false);
                  commit((n) => {
                    n.remove();
                  });
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}
      </div>
    </div>
  );
}

export type SerializedImageNode = Spread<
  {
    type: 'image';
    version: 1;
    src: string;
    /** Legacy / alternate field — importJSON reads `url` if `src` is missing. */
    url?: string;
    altText: string;
    width?: string;
    align?: ImageAlign;
    layoutMode?: ImageLayoutMode;
    x?: number;
    y?: number;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: string;
  __align: ImageAlign;
  __layoutMode: ImageLayoutMode;
  __x: number;
  __y: number;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__align,
      node.__layoutMode,
      node.__x,
      node.__y,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const fromSrc =
      typeof serializedNode.src === 'string' ? serializedNode.src.trim() : '';
    const fromUrl =
      typeof serializedNode.url === 'string' ? serializedNode.url.trim() : '';
    const safeSrc = fromSrc || fromUrl;
    const safeAltText =
      typeof serializedNode.altText === 'string' ? serializedNode.altText : '';
    const width = sanitizeWidth(serializedNode.width);
    const align = sanitizeAlign(serializedNode.align);
    const layoutMode = sanitizeLayoutMode(serializedNode.layoutMode);
    const x = sanitizeCanvasCoordinate(serializedNode.x);
    const y = sanitizeCanvasCoordinate(serializedNode.y);
    return new ImageNode(safeSrc, safeAltText, width, align, layoutMode, x, y);
  }

  constructor(
    src: string,
    altText = '',
    width: string = WIDTH_FULL,
    align: ImageAlign = 'center',
    layoutMode: ImageLayoutMode = 'flow',
    x = 0,
    y = 0,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__align = align;
    this.__layoutMode = sanitizeLayoutMode(layoutMode);
    this.__x = sanitizeCanvasCoordinate(x);
    this.__y = sanitizeCanvasCoordinate(y);
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      align: this.__align,
      layoutMode: this.__layoutMode,
      x: this.__x,
      y: this.__y,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'flowdocs-image-node';
    const theme = config.theme as { image?: string };
    if (theme.image) {
      span.classList.add(theme.image);
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  setWidth(width: string, maxContentPx?: number): void {
    const w = this.getWritable();
    const cap = maxContentPx ?? 4000;
    w.__width = sanitizeWidth(width, cap);
    if (w.__layoutMode === 'floating') {
      const imageWidthPx = parseWidthToPx(w.__width, cap);
      const imageHeightPx = 160;
      const canvasHeightPx = getFloatingCanvasHeight(imageHeightPx, w.__y);
      w.__x = clampFloatingX(w.__x, cap, imageWidthPx);
      w.__y = clampFloatingY(w.__y, imageHeightPx, canvasHeightPx);
    }
  }

  setAlign(align: ImageAlign): void {
    const w = this.getWritable();
    w.__align = sanitizeAlign(align);
  }

  setLayoutMode(
    layoutMode: ImageLayoutMode,
    canvasWidthPx?: number,
    imageWidthPx?: number,
    imageHeightPx?: number,
  ): void {
    const w = this.getWritable();
    w.__layoutMode = sanitizeLayoutMode(layoutMode);
    if (w.__layoutMode === 'floating') {
      const widthPx = imageWidthPx ?? parseWidthToPx(w.__width, canvasWidthPx ?? 4000);
      const heightPx = imageHeightPx ?? 160;
      const canvasHeightPx = getFloatingCanvasHeight(heightPx, w.__y);
      w.__x = clampFloatingX(w.__x, canvasWidthPx ?? 4000, widthPx);
      w.__y = clampFloatingY(w.__y, heightPx, canvasHeightPx);
    } else {
      w.__x = 0;
      w.__y = 0;
    }
  }

  setFloatingPosition(
    x: number,
    y: number,
    canvasWidthPx: number,
    imageWidthPx: number,
    imageHeightPx: number,
    canvasHeightPx?: number,
  ): void {
    const w = this.getWritable();
    w.__x = clampFloatingX(x, canvasWidthPx, imageWidthPx);
    w.__y = clampFloatingY(
      y,
      imageHeightPx,
      canvasHeightPx ?? getFloatingCanvasHeight(imageHeightPx, y),
    );
  }

  decorate(): JSX.Element {
    return <ImageBlockComponent nodeKey={this.__key} />;
  }
}

export function $createImageNode(
  src: string,
  altText = '',
  width: string = WIDTH_FULL,
  align: ImageAlign = 'center',
): ImageNode {
  return new ImageNode(src, altText, width, align);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
