import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { Group, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowDown,
  IconArrowUp,
  IconArrowsHorizontal,
} from '@tabler/icons-react';
import {
  $getNodeByKey,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type NodeKey,
} from 'lexical';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import editorShell from './DocumentEditorShell.module.css';
import {
  $canMoveFileAttachment,
  $moveFileAttachment,
  $patchFileAttachmentLayout,
  FILE_ATTACHMENT_LAYOUT_UPDATE_TAG,
  syncFileAttachmentLayoutDom,
  resolveFileAttachmentWrapElement,
  type FileAttachmentLayoutAlign,
  type FileAttachmentMoveDirection,
  type FileAttachmentWidthPreset,
} from './fileAttachmentLayout';
import {
  $resolveCurrentFileAttachmentForAction,
  collectFileAttachmentResolveKeys,
  getActiveFileAttachmentKey,
  scheduleFileAttachmentSelectionRestore,
  setActiveFileAttachmentKey,
  subscribeActiveFileAttachmentKey,
} from './fileAttachmentSelection';
import {
  logActionBlocked,
  logAlignAttachment,
  logMoveAttachment,
  logResizeAttachment,
  logToolbarActionDiagnostics,
  logToolbarActiveKey,
  logToolbarClick,
  logToolbarDisabledState,
} from './fileAttachmentUtils';
import { $isFileAttachmentNode, type FileAttachmentNode } from './nodes/FileAttachmentNode';

interface FileAttachmentFloatingToolbarProps {
  anchorRef: RefObject<HTMLElement | null>;
}

type ToolbarState = {
  nodeKey: NodeKey;
  top: number;
  left: number;
  layoutAlign: FileAttachmentLayoutAlign;
  widthPreset: FileAttachmentWidthPreset;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const WIDTH_OPTIONS: { value: FileAttachmentWidthPreset; label: string }[] = [
  { value: 'narrow', label: 'Dar' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Geniş' },
  { value: 'full', label: 'Tam' },
];

function buildResolveContext(
  toolbarNodeKey: NodeKey | null,
  activeKey: NodeKey | null,
) {
  return {
    toolbarNodeKey,
    activeAttachmentKey: activeKey ?? getActiveFileAttachmentKey(),
  };
}

export function FileAttachmentFloatingToolbar({
  anchorRef,
}: FileAttachmentFloatingToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [activeAttachmentKey, setActiveAttachmentKey] = useState<NodeKey | null>(
    () => getActiveFileAttachmentKey(),
  );
  const activeAttachmentKeyRef = useRef(activeAttachmentKey);
  const toolbarStateRef = useRef(toolbar);
  const lastGoodToolbarRef = useRef<ToolbarState | null>(null);
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    activeAttachmentKeyRef.current = activeAttachmentKey;
  }, [activeAttachmentKey]);

  useEffect(() => {
    toolbarStateRef.current = toolbar;
  }, [toolbar]);

  useEffect(() => {
    return subscribeActiveFileAttachmentKey(() => {
      setActiveAttachmentKey(getActiveFileAttachmentKey());
    });
  }, []);

  const updateToolbar = useCallback(() => {
    if (!canEdit) {
      setToolbar(null);
      lastGoodToolbarRef.current = null;
      return;
    }

    const activeKey = getActiveFileAttachmentKey();
    if (!activeKey) {
      if (actionInFlightRef.current && lastGoodToolbarRef.current) {
        const anchor = anchorRef.current;
        const fallbackKey = lastGoodToolbarRef.current.nodeKey;
        if (anchor && editor.getElementByKey(fallbackKey)) {
          const wrap = resolveFileAttachmentWrapElement(editor, fallbackKey);
          if (wrap) {
            const wrapRect = wrap.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            const kept: ToolbarState = {
              ...lastGoodToolbarRef.current,
              top: wrapRect.top - anchorRect.top - 44,
              left: wrapRect.left - anchorRect.left,
            };
            setToolbar(kept);
            return;
          }
        }
      }
      setToolbar(null);
      if (!actionInFlightRef.current) {
        lastGoodToolbarRef.current = null;
      }
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) {
      setToolbar(null);
      lastGoodToolbarRef.current = null;
      return;
    }

    editor.getEditorState().read(() => {
      if (import.meta.env.DEV) {
        logToolbarActiveKey({
          activeKey,
          selectionKey: null,
          canEdit,
        });
      }

      const node = $getNodeByKey(activeKey);
      if (!$isFileAttachmentNode(node)) {
        setActiveFileAttachmentKey(null);
        setToolbar(null);
        lastGoodToolbarRef.current = null;
        return;
      }

      const canMoveUp = $canMoveFileAttachment(node, 'up');
      const canMoveDown = $canMoveFileAttachment(node, 'down');

      if (import.meta.env.DEV) {
        logToolbarDisabledState({
          canMoveUp,
          canMoveDown,
          canEdit,
          hasNode: true,
        });
      }

      const wrap = resolveFileAttachmentWrapElement(editor, activeKey);
      if (!wrap) {
        if (actionInFlightRef.current && lastGoodToolbarRef.current) {
          setToolbar(lastGoodToolbarRef.current);
          return;
        }
        setToolbar(null);
        if (!actionInFlightRef.current) {
          lastGoodToolbarRef.current = null;
        }
        return;
      }

      const wrapRect = wrap.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const next: ToolbarState = {
        nodeKey: activeKey,
        top: wrapRect.top - anchorRect.top - 44,
        left: wrapRect.left - anchorRect.left,
        layoutAlign: node.getLayoutAlign(),
        widthPreset: node.getWidthPreset(),
        canMoveUp,
        canMoveDown,
      };
      lastGoodToolbarRef.current = next;
      setToolbar(next);
    });
  }, [anchorRef, canEdit, editor]);

  useEffect(() => {
    updateToolbar();
  }, [activeAttachmentKey, updateToolbar]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerUpdateListener(() => {
        updateToolbar();
      }),
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !toolbar) return undefined;

    const onScroll = () => updateToolbar();
    anchor.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      anchor.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [anchorRef, toolbar, updateToolbar]);

  const logActionResult = useCallback(
    (nodeKey: NodeKey, action: string) => {
      if (!import.meta.env.DEV) return;
      const snapshot = editor.getEditorState().read(() => {
        const resolved = $resolveCurrentFileAttachmentForAction(
          editor,
          buildResolveContext(nodeKey, getActiveFileAttachmentKey()),
        );
        const node = resolved?.node ?? null;
        const exported = node?.exportJSON();
        return {
          nodeFound: Boolean(node),
          nodeType: node?.getType() ?? null,
          isFileAttachmentNode: node ? $isFileAttachmentNode(node) : false,
          align: node?.getLayoutAlign() ?? null,
          widthPreset: node?.getWidthPreset() ?? null,
          exportAlign: exported && 'align' in exported ? exported.align : null,
          exportWidthPreset:
            exported && 'widthPreset' in exported ? exported.widthPreset : null,
        };
      });
      const domClassName =
        snapshot.align && snapshot.widthPreset
          ? syncFileAttachmentLayoutDom(
              editor,
              nodeKey,
              snapshot.align,
              snapshot.widthPreset,
            )
          : null;
      logToolbarActionDiagnostics({
        action,
        nodeKey,
        toolbarActiveAlign: toolbarStateRef.current?.layoutAlign ?? null,
        toolbarActiveWidth: toolbarStateRef.current?.widthPreset ?? null,
        ...snapshot,
        domClassName,
      });
    },
    [editor],
  );

  const runToolbarAction = useCallback(
    (
      action: string,
      mutate: (node: FileAttachmentNode, nodeKey: NodeKey) => void,
    ) => {
      if (!canEdit || actionInFlightRef.current) return;

      logToolbarClick(action);
      actionInFlightRef.current = true;

      let appliedKey: NodeKey | null = null;

      editor.update(
        () => {
          const context = buildResolveContext(
            toolbarStateRef.current?.nodeKey ?? null,
            getActiveFileAttachmentKey(),
          );
          const resolved = $resolveCurrentFileAttachmentForAction(editor, context);

          if (!resolved) {
            const keys = collectFileAttachmentResolveKeys(editor, context);
            logActionBlocked(keys);
            return;
          }

          const { node, nodeKey } = resolved;
          appliedKey = nodeKey;
          setActiveFileAttachmentKey(nodeKey);
          mutate(node, nodeKey);

          const latest = node.getLatest();
          syncFileAttachmentLayoutDom(
            editor,
            nodeKey,
            latest.getLayoutAlign(),
            latest.getWidthPreset(),
          );
        },
        { tag: FILE_ATTACHMENT_LAYOUT_UPDATE_TAG },
      );

      queueMicrotask(() => {
        actionInFlightRef.current = false;
        if (appliedKey) {
          scheduleFileAttachmentSelectionRestore(editor, appliedKey, { toolbarAction: true });
          logActionResult(appliedKey, action);
        }
        updateToolbar();
      });
    },
    [canEdit, editor, logActionResult, updateToolbar],
  );

  const stopToolbarBubble = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  const patchAttachment = useCallback(
    (
      clickAction: string,
      patch: {
        layoutAlign?: FileAttachmentLayoutAlign;
        widthPreset?: FileAttachmentWidthPreset;
      },
    ) => {
      runToolbarAction(clickAction, (node) => {
        $patchFileAttachmentLayout(node, patch);
        if (patch.layoutAlign) logAlignAttachment(patch.layoutAlign);
        if (patch.widthPreset) logResizeAttachment(patch.widthPreset);
      });
    },
    [runToolbarAction],
  );

  const moveAttachment = useCallback(
    (clickAction: string, direction: FileAttachmentMoveDirection) => {
      runToolbarAction(clickAction, (node) => {
        if (!$canMoveFileAttachment(node, direction)) {
          logMoveAttachment(direction, false);
          return;
        }
        const success = $moveFileAttachment(node, direction);
        if (!success) {
          logMoveAttachment(direction, false);
        }
      });
    },
    [runToolbarAction],
  );

  const handleAlignMouseDown = useCallback(
    (clickAction: string, align: FileAttachmentLayoutAlign) => (event: MouseEvent) => {
      stopToolbarBubble(event);
      patchAttachment(clickAction, { layoutAlign: align });
    },
    [patchAttachment, stopToolbarBubble],
  );

  const handleWidthMouseDown = useCallback(
    (clickAction: string, widthPreset: FileAttachmentWidthPreset) => (event: MouseEvent) => {
      stopToolbarBubble(event);
      patchAttachment(clickAction, { widthPreset });
    },
    [patchAttachment, stopToolbarBubble],
  );

  const handleMoveMouseDown = useCallback(
    (clickAction: string, direction: FileAttachmentMoveDirection) => (event: MouseEvent) => {
      stopToolbarBubble(event);
      moveAttachment(clickAction, direction);
    },
    [moveAttachment, stopToolbarBubble],
  );

  if (!canEdit || !activeAttachmentKey || !toolbar) return null;

  return (
    <div
      className={editorShell.tableFloatingToolbar}
      data-flowdocs-file-attachment-toolbar
      style={{
        top: Math.max(8, toolbar.top),
        left: toolbar.left,
        zIndex: 500,
        pointerEvents: 'auto',
      }}
      role="toolbar"
      aria-label="Dosya eki düzeni"
      onMouseDown={stopToolbarBubble}
    >
      <Group gap={2} wrap="nowrap">
        <Tooltip label="Sola hizala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'left' || undefined}
            aria-label="Sola hizala"
            onMouseDown={handleAlignMouseDown('align-left', 'left')}
          >
            <IconAlignLeft size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Ortala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'center' || undefined}
            aria-label="Ortala"
            onMouseDown={handleAlignMouseDown('align-center', 'center')}
          >
            <IconAlignCenter size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Sağa hizala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'right' || undefined}
            aria-label="Sağa hizala"
            onMouseDown={handleAlignMouseDown('align-right', 'right')}
          >
            <IconAlignRight size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Group>
      <span className={editorShell.tableFloatingDivider} aria-hidden />
      <Group gap={2} wrap="nowrap">
        <Tooltip
          label={toolbar.canMoveUp ? 'Yukarı taşı' : 'Yukarı taşınamaz (üstte blok yok)'}
          withArrow
          position="top"
          openDelay={300}
        >
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            disabled={!toolbar.canMoveUp}
            aria-label="Yukarı taşı"
            onMouseDown={handleMoveMouseDown('move-up', 'up')}
          >
            <IconArrowUp size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip
          label={toolbar.canMoveDown ? 'Aşağı taşı' : 'Aşağı taşınamaz (altta blok yok)'}
          withArrow
          position="top"
          openDelay={300}
        >
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            disabled={!toolbar.canMoveDown}
            aria-label="Aşağı taşı"
            onMouseDown={handleMoveMouseDown('move-down', 'down')}
          >
            <IconArrowDown size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Group>
      <span className={editorShell.tableFloatingDivider} aria-hidden />
      <Group gap={2} wrap="nowrap">
        {WIDTH_OPTIONS.map((option) => (
          <Tooltip key={option.value} label={option.label} withArrow position="top" openDelay={300}>
            <UnstyledButton
              type="button"
              className={editorShell.tableFloatingWidthBtn}
              data-active={toolbar.widthPreset === option.value || undefined}
              aria-label={`Genişlik: ${option.label}`}
              onMouseDown={handleWidthMouseDown(`width-${option.value}`, option.value)}
            >
              {option.value === 'full' ? (
                <IconArrowsHorizontal size={14} stroke={2} />
              ) : (
                option.label
              )}
            </UnstyledButton>
          </Tooltip>
        ))}
      </Group>
    </div>
  );
}